const BASE_URL = 'https://api.semanticscholar.org/graph/v1'
const DEFAULT_FIELDS = [
  'paperId',
  'title',
  'abstract',
  'authors',
  'year',
  'venue',
  'externalIds',
  'url',
  'citationCount',
  'publicationDate',
  'publicationTypes'
].join(',')

const memoryCache = new Map()
const inflight = new Map()

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function positiveInt(value, fallback, max) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

function normalizePaper(paper) {
  if (!paper || typeof paper !== 'object') return null
  return {
    paperId: paper.paperId || null,
    title: paper.title || null,
    abstract: paper.abstract || null,
    authors: Array.isArray(paper.authors)
      ? paper.authors.map((author) => ({
          authorId: author?.authorId || null,
          name: author?.name || null
        }))
      : [],
    year: paper.year ?? null,
    venue: paper.venue || null,
    externalIds: paper.externalIds || {},
    url: paper.url || null,
    citationCount: paper.citationCount ?? null,
    publicationDate: paper.publicationDate || null,
    publicationTypes: Array.isArray(paper.publicationTypes) ? paper.publicationTypes : []
  }
}

function cacheKey(url) {
  return url.toString()
}

function readMemoryCache(key, now = Date.now()) {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

function writeMemoryCache(key, value, ttlSeconds, now = Date.now()) {
  memoryCache.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000
  })
}

async function readSharedCache(url) {
  const cache = globalThis.caches?.default
  if (!cache) return null

  try {
    const response = await cache.match(new Request(url.toString(), { method: 'GET' }))
    if (!response || !response.ok) return null
    return await response.json()
  } catch (error) {
    return null
  }
}

async function writeSharedCache(url, value, ttlSeconds) {
  const cache = globalThis.caches?.default
  if (!cache) return

  try {
    const response = new Response(JSON.stringify(value), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${ttlSeconds}`
      }
    })
    await cache.put(new Request(url.toString(), { method: 'GET' }), response)
  } catch (error) {
    // Shared cache is an optimization. The global Durable Object quota remains
    // authoritative, so cache failures do not bypass rate protection.
  }
}

async function acquireSemanticScholarQuota(env) {
  const namespace = env?.TORQUEMIND_RATE_LIMITER
  if (!namespace) {
    throw Object.assign(new Error('Semantic Scholar rate limiter is not configured'), {
      code: 'RATE_LIMITER_NOT_CONFIGURED'
    })
  }

  const id = namespace.idFromName('semantic-scholar-global')
  const stub = namespace.get(id)
  const windowSeconds = positiveInt(env?.SEMANTIC_SCHOLAR_RATE_WINDOW_SECONDS, 2, 10)
  const response = await stub.fetch(
    new Request('https://torquemind.rate/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 1, windowSeconds })
    })
  )

  let payload = {}
  try {
    payload = await response.json()
  } catch (error) {
    payload = {}
  }

  if (response.status === 429 || payload.allowed === false) {
    const retryAfterSeconds = positiveInt(payload.retryAfterSeconds, windowSeconds, 30)
    const error = new Error('Semantic Scholar request quota is busy')
    error.code = 'LOCAL_RATE_LIMITED'
    error.retryAfterSeconds = retryAfterSeconds
    throw error
  }

  if (!response.ok) {
    throw Object.assign(new Error('Semantic Scholar rate limiter unavailable'), {
      code: 'RATE_LIMITER_UNAVAILABLE'
    })
  }
}

async function resolveSemanticScholarApiKey(env) {
  const binding = env?.SEMANTIC_SCHOLAR_API_KEY

  if (binding && typeof binding.get === 'function') {
    const value = await binding.get()
    return String(value || '').trim()
  }

  // Local development and unit tests may provide a plain string through
  // .dev.vars. Production uses the Cloudflare Secrets Store binding.
  return String(binding || '').trim()
}

async function requestSemanticScholar(url, env, options = {}) {
  const apiKey = await resolveSemanticScholarApiKey(env)
  if (!apiKey) {
    throw Object.assign(new Error('Semantic Scholar API key is not configured'), {
      code: 'API_KEY_NOT_CONFIGURED'
    })
  }

  const ttlSeconds = positiveInt(
    options.ttlSeconds ?? env?.SEMANTIC_SCHOLAR_CACHE_TTL_SECONDS,
    21600,
    86400
  )
  const key = cacheKey(url)
  const cached = readMemoryCache(key)
  if (cached) return { value: cached, cache: 'memory-hit' }

  const sharedCached = await readSharedCache(url)
  if (sharedCached) {
    writeMemoryCache(key, sharedCached, ttlSeconds)
    return { value: sharedCached, cache: 'shared-hit' }
  }

  if (inflight.has(key)) return inflight.get(key)

  const task = (async () => {
    const maxRetries = positiveInt(env?.SEMANTIC_SCHOLAR_MAX_RETRIES, 2, 3)
    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await acquireSemanticScholarQuota(env)

      let response
      try {
        response = await fetch(url, {
          headers: {
            accept: 'application/json',
            'x-api-key': apiKey
          }
        })
      } catch (error) {
        lastError = error
        if (attempt >= maxRetries) break
        await delay(Math.min(500 * (2 ** attempt), 2000))
        continue
      }

      if (response.ok) {
        const value = await response.json()
        writeMemoryCache(key, value, ttlSeconds)
        await writeSharedCache(url, value, ttlSeconds)
        return { value, cache: 'miss' }
      }

      if (response.status === 404) {
        const error = new Error('Semantic Scholar resource not found')
        error.code = 'UPSTREAM_NOT_FOUND'
        throw error
      }

      if (response.status !== 429 && response.status < 500) {
        const error = new Error('Semantic Scholar rejected the request')
        error.code = 'UPSTREAM_REJECTED'
        error.status = response.status
        throw error
      }

      lastError = new Error(`Semantic Scholar upstream returned ${response.status}`)
      lastError.code = 'UPSTREAM_RETRYABLE'
      lastError.status = response.status

      if (attempt < maxRetries) {
        const retryAfter = Number(response.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 4000)
          : Math.min(750 * (2 ** attempt), 3000)
        await delay(waitMs)
      }
    }

    throw lastError || Object.assign(new Error('Semantic Scholar request failed'), {
      code: 'UPSTREAM_FAILED'
    })
  })()

  inflight.set(key, task)
  try {
    return await task
  } finally {
    inflight.delete(key)
  }
}

export async function searchSemanticScholar(query, limit, env) {
  const q = String(query || '').trim()
  if (q.length < 3 || q.length > 300) {
    throw Object.assign(new Error('Query must be between 3 and 300 characters'), {
      code: 'INVALID_QUERY'
    })
  }

  const safeLimit = positiveInt(limit, 5, 10)
  const url = new URL(`${BASE_URL}/paper/search`)
  url.searchParams.set('query', q)
  url.searchParams.set('limit', String(safeLimit))
  url.searchParams.set('fields', DEFAULT_FIELDS)

  const result = await requestSemanticScholar(url, env)
  const data = Array.isArray(result.value?.data)
    ? result.value.data.map(normalizePaper).filter(Boolean)
    : []

  return {
    provider: 'Semantic Scholar',
    providerUrl: 'https://www.semanticscholar.org/',
    usage: 'research-discovery',
    reviewStatus: 'unreviewed',
    assessmentEligibility: 'none',
    cache: result.cache,
    total: Number(result.value?.total) || data.length,
    offset: Number(result.value?.offset) || 0,
    next: Number.isFinite(Number(result.value?.next)) ? Number(result.value.next) : null,
    data
  }
}

export async function getSemanticScholarPaper(paperId, env) {
  const id = String(paperId || '').trim()
  if (!id || id.length > 250 || /[\r\n]/.test(id)) {
    throw Object.assign(new Error('Invalid paper identifier'), {
      code: 'INVALID_PAPER_ID'
    })
  }

  const url = new URL(`${BASE_URL}/paper/${encodeURIComponent(id)}`)
  url.searchParams.set('fields', DEFAULT_FIELDS)

  const result = await requestSemanticScholar(url, env, { ttlSeconds: 86400 })
  return {
    provider: 'Semantic Scholar',
    providerUrl: 'https://www.semanticscholar.org/',
    usage: 'research-metadata',
    reviewStatus: 'unreviewed',
    assessmentEligibility: 'none',
    cache: result.cache,
    data: normalizePaper(result.value)
  }
}

export function _resetSemanticScholarStateForTests() {
  memoryCache.clear()
  inflight.clear()
}

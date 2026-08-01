import { createHash } from 'crypto'

const DEFAULTS = {
  max: Number(process.env.TORQUEMIND_RATE_LIMIT_MAX) || 10,
  windowSeconds: Number(process.env.TORQUEMIND_RATE_LIMIT_WINDOW_SECONDS) || 60
}

function safeNum(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export function createInMemoryStore() {
  const map = new Map()
  return {
    async increment(key, windowMs, nowMs) {
      const now = nowMs ?? Date.now()
      const entry = map.get(key)
      if (!entry || entry.expiresAt <= now) {
        const expiresAt = now + windowMs
        map.set(key, { count: 1, expiresAt })
        return { count: 1, expiresAt }
      }
      entry.count += 1
      return { count: entry.count, expiresAt: entry.expiresAt }
    },
    async get(key) {
      const e = map.get(key)
      return e ? { count: e.count, expiresAt: e.expiresAt } : null
    },
    // helper for tests
    _clear() { map.clear() }
  }
}

function hashId(id) {
  try {
    return createHash('sha256').update(id).digest('hex').slice(0, 12)
  } catch (e) {
    return `h-${String(id).slice(0, 12)}`
  }
}

export function createRateLimitMiddleware(options = {}) {
  const max = safeNum(options.max ?? DEFAULTS.max, DEFAULTS.max)
  const windowSeconds = safeNum(options.windowSeconds ?? DEFAULTS.windowSeconds, DEFAULTS.windowSeconds)
  const windowMs = windowSeconds * 1000
  const store = options.store ?? createInMemoryStore()
  const clock = options.clock ?? { now: () => Date.now() }

  return async (c, next) => {
    try {
      const method = (c.req && c.req.method) || (c.method) || 'GET'
      // only rate limit POST to the tutor route
      if (method.toUpperCase() !== 'POST') return await next()

      // derive client id from headers
      const headers = c.req && c.req.headers
      const rawClient = headers && (headers.get('CF-Connecting-IP') || headers.get('x-forwarded-for') || headers.get('x-real-ip') || headers.get('remote-addr'))
      const clientId = rawClient ? String(rawClient) : 'anon'
      const clientHash = hashId(clientId)

      const route = c.path || '/api/torquemind-feedback'
      const key = `${route}:${clientHash}`

      const now = clock.now()
      const res = await store.increment(key, windowMs, now)
      const remaining = Math.max(0, max - res.count)

      // set rate limit headers, preserve request id if present
      const rid = c.reqId || (c.req && c.reqId) || null
      if (typeof c.header === 'function') {
        c.header('X-RateLimit-Limit', String(max))
        c.header('X-RateLimit-Remaining', String(remaining))
        if (rid) c.header('x-request-id', rid)
      }

      if (res.count > max) {
        const retryAfterSeconds = Math.max(1, Math.ceil((res.expiresAt - now) / 1000))
        if (typeof c.header === 'function') c.header('Retry-After', String(retryAfterSeconds))
        // structured rate_limited event (do not include raw IP)
        try {
          console.log(JSON.stringify({
            event: 'torquemind.feedback.rate_limited',
            requestId: rid || null,
            client: clientHash,
            limit: max,
            remaining,
            retryAfterSeconds,
            route,
            method: method.toUpperCase()
          }))
        } catch (e) {}

        return c.json({ error: 'Too many TorqueMind tutor requests', retryAfterSeconds }, 429)
      }

      // allowed
      return await next()
    } catch (err) {
      // on error, fail open (do not block traffic)
      return await next()
    }
  }
}

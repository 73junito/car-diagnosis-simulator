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
      let res
      let usedDo = false

      // Prefer explicit store from options (used by tests). Otherwise, if DO is configured and enabled, use it.
      const useDoFlag = (c.env && (String(c.env.USE_DO_RATE_LIMIT) === 'true')) || String(process.env.USE_DO_RATE_LIMIT) === 'true'
      const doNamespace = c.env && c.env.TORQUEMIND_RATE_LIMITER

      if (!options.store && useDoFlag) {
        // production path: require DO binding; fail closed if missing
        if (!doNamespace) {
          // Fail closed: controlled 503
          const payload = { error: 'Rate limiter not configured' }
          if (typeof c.json === 'function') return c.json(payload, 503)
          return new Response(JSON.stringify(payload), { status: 503, headers: { 'Content-Type': 'application/json' } })
        }

        try {
          const id = doNamespace.idFromName(clientHash)
          const stub = doNamespace.get(id)
          const req = new Request('https://torquemind.rate/check', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ limit: max, windowSeconds })
          })
          const dres = await stub.fetch(req)
          let body = {}
          try {
            if (dres && typeof dres.json === 'function') body = await dres.json()
            else {
              const txt = dres && typeof dres.text === 'function' ? await dres.text() : null
              body = txt ? JSON.parse(txt) : {}
            }
          } catch (err) {
            body = {}
          }
          res = { count: (typeof body.count === 'number') ? body.count : ((typeof body.remaining === 'number') ? (max - body.remaining) : 0), expiresAt: body.resetAt || (now + windowMs) }
          usedDo = true
        } catch (e) {
          // DO call failed — fail closed in production
          try { console.error('DO error', e && (e.stack || e.message || e)) } catch (err) {}
          try { console.log(JSON.stringify({ event: 'torquemind.feedback.rate_limit.do_unavailable', client: clientHash, requestId: c.reqId || null })) } catch (err) {}
          const payload = { error: 'Rate limiter unavailable' }
          if (typeof c.json === 'function') return c.json(payload, 503)
          return new Response(JSON.stringify(payload), { status: 503, headers: { 'Content-Type': 'application/json' } })
        }
      } else {
        res = await store.increment(key, windowMs, now)
      }
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

        const payload = { error: 'Too many TorqueMind tutor requests', retryAfterSeconds }
        if (typeof c.json === 'function') return c.json(payload, 429)
        return new Response(JSON.stringify(payload), { status: 429, headers: { 'Content-Type': 'application/json' } })
      }

      // allowed
      return await next()
    } catch (err) {
      // on error, fail open (do not block traffic)
      return await next()
    }
  }
}

export class TorqueMindRateLimitCounter {
  constructor(state, env) {
    this.state = state
    this.env = env
  }

  async fetch(req) {
    try {
      const url = new URL(req.url)
      if (req.method !== 'POST' || url.pathname !== '/check') {
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
      }

      let body = {}
      try {
        const txt = await req.text()
        body = txt ? JSON.parse(txt) : {}
      } catch (e) {
        body = {}
      }
      const limit = Number(body.limit) || 10
      const windowSeconds = Number(body.windowSeconds) || 60
      const now = Date.now()
      const windowMs = windowSeconds * 1000
      const windowStart = Math.floor(now / windowMs) * windowMs

      // Use blockConcurrencyWhile to serialize updates for this object's storage
      let result = await this.state.blockConcurrencyWhile(async () => {
        const key = 'counter'
        const entry = (await this.state.storage.get(key)) || null
        if (!entry || entry.windowStart !== windowStart || (entry.expiresAt && entry.expiresAt <= now)) {
          const expiresAt = windowStart + windowMs + 5000
          const e = { count: 1, windowStart, expiresAt }
          await this.state.storage.put(key, e)
          return { count: 1, expiresAt }
        }
        entry.count += 1
        await this.state.storage.put(key, entry)
        return { count: entry.count, expiresAt: entry.expiresAt }
      })

      const allowed = result.count <= limit
      const remaining = Math.max(0, limit - result.count)
      const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((result.expiresAt - Date.now()) / 1000))
      const resetAt = result.expiresAt

      const payload = { allowed, limit, count: result.count, remaining, retryAfterSeconds, resetAt }
      // In Cloudflare runtime, return a proper Response. In Jest/node tests,
      // a global Response may not exist, so fall back to an object with the
      // same shape (status, text(), json()) used by tests.
      if (typeof Response === 'function') {
        return new Response(JSON.stringify(payload), {
          status: allowed ? 200 : 429,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return {
        status: allowed ? 200 : 429,
        text: async () => JSON.stringify(payload),
        json: async () => payload
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: 'internal' }), { status: 500 })
    }
  }
}

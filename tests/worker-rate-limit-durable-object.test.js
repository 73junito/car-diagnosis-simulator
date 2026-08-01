import { TorqueMindRateLimitCounter } from '../worker/durable-objects/rate-limit-counter.js'
import { createRateLimitMiddleware } from '../worker/middleware/rate-limit.js'

function createMockState() {
  const map = new Map()
  let chain = Promise.resolve()
  return {
    storage: {
      get: async (k) => map.get(k) || null,
      put: async (k, v) => map.set(k, v)
    },
    blockConcurrencyWhile: (fn) => {
      chain = chain.then(() => fn())
      return chain
    }
  }
}

describe('Durable Object rate limiter', () => {
  test('DO class enforces fixed-window limit and reset', async () => {
    const state = createMockState()
    const doObj = new TorqueMindRateLimitCounter(state, {})

    const req = (limit, windowSeconds) => ({ method: 'POST', url: 'https://x/check', headers: { 'content-type': 'application/json' }, text: async () => JSON.stringify({ limit, windowSeconds }) })

    // first allowed
    let r = await doObj.fetch(req(2, 1))
    expect(r.status).toBe(200)
    const txt = (r && typeof r.text === 'function') ? await r.text() : null
    console.log('DO response text:', txt)
    let body = txt ? JSON.parse(txt) : {}
    expect(body.allowed).toBe(true)

    // second allowed
    r = await doObj.fetch(req(2, 1))
    expect(r.status).toBe(200)
    const txt2 = (r && typeof r.text === 'function') ? await r.text() : null
    body = txt2 ? JSON.parse(txt2) : {}
    expect(body.allowed).toBe(true)

    // third rejected
    r = await doObj.fetch(req(2, 1))
    expect(r.status).toBe(429)
    const txt3 = (r && typeof r.text === 'function') ? await r.text() : null
    body = txt3 ? JSON.parse(txt3) : {}
    expect(body.allowed).toBe(false)

    // advance window by mocking Date.now
    const realNow = Date.now
    try {
      const future = realNow() + 1500
      jest.spyOn(Date, 'now').mockImplementation(() => future)
      const r2 = await doObj.fetch(req(2, 1))
      expect(r2.status).toBe(200)
      const t2 = (r2 && typeof r2.text === 'function') ? await r2.text() : null
      const b2 = t2 ? JSON.parse(t2) : {}
      expect(b2.allowed).toBe(true)
    } finally {
      jest.spyOn(Date, 'now').mockRestore()
    }
  })

  test('middleware integrates with DO binding and isolates clients', async () => {
    // create a namespace that returns a DO instance per id
    const instances = {}
    const namespace = {
      idFromName: (name) => name,
      get: (id) => {
        if (!instances[id]) instances[id] = new TorqueMindRateLimitCounter(createMockState(), {})
        return { fetch: (req) => instances[id].fetch(req) }
      }
    }

    const mw = createRateLimitMiddleware({ max: 1, windowSeconds: 60 })
    const next = jest.fn()

    const headersA = new Map([['CF-Connecting-IP','1.1.1.1']])
    const cA = { req: { method: 'POST', headers: { get: (k) => headersA.get(k) } }, header: jest.fn(), reqId: 'ra', path: '/api/torquemind-feedback', env: { USE_DO_RATE_LIMIT: 'true', TORQUEMIND_RATE_LIMITER: namespace }, json: (p,s) => ({ status: s, payload: p }) }
    const res1 = await mw(cA, next)
    expect(next).toHaveBeenCalled()

    // second request should be rate limited
    const res2 = await mw(cA, next)
    expect(res2.status).toBe(429)

    // different client uses separate DO instance
    const headersB = new Map([['CF-Connecting-IP','2.2.2.2']])
    const cB = { req: { method: 'POST', headers: { get: (k) => headersB.get(k) } }, header: jest.fn(), reqId: 'rb', path: '/api/torquemind-feedback', env: { USE_DO_RATE_LIMIT: 'true', TORQUEMIND_RATE_LIMITER: namespace }, json: (p,s) => ({ status: s, payload: p }) }
    const resB = await mw(cB, next)
    expect(resB).toBeUndefined() // next called
  })

  test('missing DO binding in production fails closed', async () => {
    const mw = createRateLimitMiddleware({ max: 1, windowSeconds: 60 })
    const next = jest.fn()
    const headers = new Map([['CF-Connecting-IP','3.3.3.3']])
    const c = { req: { method: 'POST', headers: { get: (k) => headers.get(k) } }, header: jest.fn(), reqId: 'r-missing', path: '/api/torquemind-feedback', env: { USE_DO_RATE_LIMIT: 'true' }, json: (p,s) => ({ status: s, payload: p }) }
    const res = await mw(c, next)
    expect(res.status).toBe(503)
  })
})

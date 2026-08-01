import { createRateLimitMiddleware, createInMemoryStore } from '../worker/middleware/rate-limit.js'

describe('rate limit middleware', () => {
  let store, clock
  beforeEach(() => {
    store = createInMemoryStore()
    clock = { now: () => Date.now() }
    jest.useRealTimers()
  })

  test('requests below limit continue and headers set', async () => {
    const mw = createRateLimitMiddleware({ max: 3, windowSeconds: 60, store, clock })
    const next = jest.fn()
    const headers = new Map()
    const c = { req: { method: 'POST', headers: { get: (k) => headers.get(k) } }, header: jest.fn(), reqId: 'r1', path: '/api/torquemind-feedback' }
    headers.set('CF-Connecting-IP', '1.2.3.4')
    await mw(c, next)
    expect(next).toHaveBeenCalled()
    expect(c.header).toHaveBeenCalledWith('X-RateLimit-Limit', '3')
  })

  test('request at limit succeeds, next request is 429', async () => {
    const mw = createRateLimitMiddleware({ max: 2, windowSeconds: 60, store, clock })
    const headers = new Map([['CF-Connecting-IP','10.0.0.1']])
    const c1 = { req: { method: 'POST', headers: { get: (k) => headers.get(k) } }, header: jest.fn(), reqId: 'r2', path: '/api/torquemind-feedback' }
    const next = jest.fn()
    // two allowed
    await mw(c1, next)
    await mw(c1, next)
    expect(next).toHaveBeenCalledTimes(2)
    // third should be rate limited
    const c2 = { req: { method: 'POST', headers: { get: (k) => headers.get(k) } }, header: jest.fn(), reqId: 'r2', path: '/api/torquemind-feedback', json: jest.fn(), env: {} }
    // capture response via returned value
    const res = await mw(c2, next)
    // Hono context's c.json returns Response; our middleware returns that, but in tests ensure headers set and json returned
    expect(c2.header).toHaveBeenCalledWith('Retry-After', expect.any(String))
  })

  test('window expiration resets the count', async () => {
    const fakeNow = Date.now()
    let now = fakeNow
    clock = { now: () => now }
    store = createInMemoryStore()
    const mw = createRateLimitMiddleware({ max: 1, windowSeconds: 1, store, clock })
    const headers = new Map([['CF-Connecting-IP','9.9.9.9']])
    const c = { req: { method: 'POST', headers: { get: (k) => headers.get(k) } }, header: jest.fn(), reqId: 'r3', path: '/api/torquemind-feedback' }
    const next = jest.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalledTimes(1)
    // advance past window
    now += 1500
    await mw(c, next)
    expect(next).toHaveBeenCalledTimes(2)
  })

  test('different clients have separate counters', async () => {
    const mw = createRateLimitMiddleware({ max: 1, windowSeconds: 60, store, clock })
    const headersA = new Map([['CF-Connecting-IP','1.1.1.1']])
    const headersB = new Map([['CF-Connecting-IP','2.2.2.2']])
    const cA = { req: { method: 'POST', headers: { get: (k) => headersA.get(k) } }, header: jest.fn(), reqId: 'ra', path: '/api/torquemind-feedback' }
    const cB = { req: { method: 'POST', headers: { get: (k) => headersB.get(k) } }, header: jest.fn(), reqId: 'rb', path: '/api/torquemind-feedback' }
    const next = jest.fn()
    await mw(cA, next)
    await mw(cB, next)
    expect(next).toHaveBeenCalledTimes(2)
  })

  test('non-tutor routes unaffected', async () => {
    const mw = createRateLimitMiddleware({ max: 1, windowSeconds: 60, store, clock })
    const c = { req: { method: 'GET', headers: { get: () => null } }, header: jest.fn(), reqId: 'r4', path: '/some/other' }
    const next = jest.fn()
    await mw(c, next)
    expect(next).toHaveBeenCalled()
  })

  test('request id header remains present and logs contain no raw ip', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const mw = createRateLimitMiddleware({ max: 1, windowSeconds: 60, store, clock })
    const headers = new Map([['CF-Connecting-IP','55.55.55.55']])
    const c = { req: { method: 'POST', headers: { get: (k) => headers.get(k) } }, header: jest.fn(), reqId: 'r-log', path: '/api/torquemind-feedback' }
    const next = jest.fn()
    // hit twice to trigger rate limit
    await mw(c, next)
    await mw(c, next)
    expect(c.header).toHaveBeenCalledWith('x-request-id', 'r-log')
    // ensure logged payload does not include the raw IP string
    const calls = spy.mock.calls.map(c => c.join(' ')).join(' ')
    expect(calls).not.toContain('55.55.55.55')
    spy.mockRestore()
  })
})

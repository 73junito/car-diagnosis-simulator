import { createRequestContext } from '../worker/middleware/request-context.js'

describe('request-context middleware', () => {
  test('accepts valid x-request-id and sets header', async () => {
    const middleware = createRequestContext()
    const headers = new Map([['x-request-id', 'abc12345-xyz']])
    const req = { headers: { get: (k) => headers.get(k) } }
    const c = { req, header: jest.fn(), set: jest.fn() }
    await middleware(c, async () => {})
    expect(c.reqId).toBeTruthy()
    expect(c.header).toHaveBeenCalledWith('x-request-id', c.reqId)
  })

  test('generates uuid when header invalid', async () => {
    const middleware = createRequestContext()
    const req = { headers: { get: () => '!!invalid!!' } }
    const c = { req, header: jest.fn(), set: jest.fn() }
    await middleware(c, async () => {})
    expect(c.reqId).toBeTruthy()
    expect(c.reqId.length).toBeGreaterThan(8)
  })
})

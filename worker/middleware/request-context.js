import { randomUUID } from 'crypto'

const SAFE_ID_RE = /^[A-Za-z0-9\-_:]{8,64}$/

export function createRequestContext() {
  return async (c, next) => {
    let reqId = ''
    try {
      if (c && c.req && c.req.headers && typeof c.req.headers.get === 'function') {
        reqId = c.req.headers.get('x-request-id') || ''
      }
    } catch (e) {
      reqId = ''
    }
    if (!SAFE_ID_RE.test(reqId)) {
      try {
        reqId = randomUUID()
      } catch (e) {
        // fallback simple id
        reqId = `rid-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      }
    }
    // attach to context
    c.reqId = reqId
    // ensure header present on response if available
    if (typeof c.header === 'function') c.header('x-request-id', reqId)
    const start = Date.now()
    if (typeof c.set === 'function') c.set('req_start', start)
    try {
      await next()
    } finally {
      const end = Date.now()
      if (typeof c.set === 'function') c.set('req_duration_ms', end - start)
    }
  }
}

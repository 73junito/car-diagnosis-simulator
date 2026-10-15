import { resolveRequestCorrelation } from '../utils/request-correlation.js'
import {
  logHttpRequestStarted,
  logHttpRequestCompleted,
  logHttpRequestFailed
} from '../utils/request-lifecycle-logger.js'

export function createRequestContext({ surface = 'app', logRequests = true } = {}) {
  return async (c, next) => {
    const correlation = resolveRequestCorrelation(c?.req?.raw || c?.req)
    const method = c?.req?.method || null
    const path = c?.req?.path || null
    const start = Date.now()

    c.reqId = correlation.requestId
    c.traceId = correlation.traceId
    c.cfRay = correlation.cfRay

    if (typeof c.set === 'function') {
      c.set('request_correlation', correlation)
      c.set('req_start', start)
    }

    if (typeof c.header === 'function') {
      c.header('x-request-id', correlation.requestId)
      if (correlation.traceId) c.header('x-trace-id', correlation.traceId)
    }

    if (logRequests) {
      logHttpRequestStarted({ surface, correlation, method, path })
    }

    try {
      await next()
      const durationMs = Date.now() - start
      if (typeof c.set === 'function') c.set('req_duration_ms', durationMs)
      if (logRequests) {
        logHttpRequestCompleted({
          surface,
          correlation,
          method,
          path,
          status: c?.res?.status || 200,
          durationMs
        })
      }
    } catch (error) {
      const durationMs = Date.now() - start
      if (typeof c.set === 'function') c.set('req_duration_ms', durationMs)
      if (logRequests) {
        logHttpRequestFailed({
          surface,
          correlation,
          method,
          path,
          errorType: error?.name || 'unhandled_error',
          durationMs
        })
      }
      throw error
    }
  }
}

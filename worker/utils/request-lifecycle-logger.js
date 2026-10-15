function clean(value) {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

function emit(payload) {
  console.log(JSON.stringify(payload))
}

export function logHttpRequestStarted({ surface, correlation, method, path }) {
  emit({
    event: 'autolearnpro.http.started',
    surface: clean(surface),
    requestId: clean(correlation?.requestId),
    traceId: clean(correlation?.traceId),
    cfRay: clean(correlation?.cfRay),
    method: clean(method),
    path: clean(path)
  })
}

export function logHttpRequestCompleted({ surface, correlation, method, path, status, durationMs }) {
  emit({
    event: 'autolearnpro.http.completed',
    surface: clean(surface),
    requestId: clean(correlation?.requestId),
    traceId: clean(correlation?.traceId),
    cfRay: clean(correlation?.cfRay),
    method: clean(method),
    path: clean(path),
    status: Number(status) || 0,
    durationMs: Number(durationMs) || 0
  })
}

export function logHttpRequestFailed({ surface, correlation, method, path, errorType, durationMs }) {
  emit({
    event: 'autolearnpro.http.failed',
    surface: clean(surface),
    requestId: clean(correlation?.requestId),
    traceId: clean(correlation?.traceId),
    cfRay: clean(correlation?.cfRay),
    method: clean(method),
    path: clean(path),
    errorType: clean(errorType) || 'unhandled_error',
    durationMs: Number(durationMs) || 0
  })
}

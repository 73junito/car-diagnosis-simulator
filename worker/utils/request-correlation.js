const SAFE_REQUEST_ID_RE = /^[A-Za-z0-9\-_:]{8,64}$/
const TRACEPARENT_RE = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i
const SAFE_CF_RAY_RE = /^[A-Za-z0-9-]{8,64}$/

function safeHeader(request, name) {
  try {
    return request?.headers?.get?.(name) || ''
  } catch {
    return ''
  }
}

function createRequestId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `rid-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
  }
}

export function resolveRequestCorrelation(request) {
  const suppliedRequestId = safeHeader(request, 'x-request-id').trim()
  const requestId = SAFE_REQUEST_ID_RE.test(suppliedRequestId)
    ? suppliedRequestId
    : createRequestId()

  const traceparent = safeHeader(request, 'traceparent').trim()
  const traceMatch = TRACEPARENT_RE.exec(traceparent)
  const traceId = traceMatch ? traceMatch[1].toLowerCase() : null

  const rawCfRay = safeHeader(request, 'cf-ray').trim()
  const cfRay = SAFE_CF_RAY_RE.test(rawCfRay) ? rawCfRay : null

  return {
    requestId,
    traceId,
    cfRay,
    traceparent: traceMatch ? traceparent.toLowerCase() : null
  }
}

export function applyCorrelationResponseHeaders(response, correlation) {
  const headers = new Headers(response.headers)
  headers.set('x-request-id', correlation.requestId)
  if (correlation.traceId) headers.set('x-trace-id', correlation.traceId)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

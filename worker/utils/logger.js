function safeString(v) {
  if (v === undefined || v === null) return null
  return typeof v === 'string' ? v : String(v)
}

function emit(obj) {
  try {
    // always JSON on single line
    console.log(JSON.stringify(obj))
  } catch (e) {
    console.log(JSON.stringify({ event: 'log_error', errorType: 'serialization_error' }))
  }
}

export function logRequestStart({ requestId, method, route, provider, model, providerHost }) {
  emit({
    event: 'torquemind.feedback.started',
    requestId: safeString(requestId),
    method: safeString(method),
    route: safeString(route),
    provider: safeString(provider),
    model: safeString(model),
    providerHost: safeString(providerHost)
  })
}

export function logRequestCompleted({ requestId, method, route, status, durationMs, provider, model, providerHost }) {
  emit({
    event: 'torquemind.feedback.completed',
    requestId: safeString(requestId),
    method: safeString(method),
    route: safeString(route),
    status: Number(status) || 0,
    durationMs: Number(durationMs) || 0,
    provider: safeString(provider),
    model: safeString(model),
    providerHost: safeString(providerHost)
  })
}

export function logRequestFailed({ requestId, status, errorType, provider, model, providerHost, upstreamStatus }) {
  const out = {
    event: 'torquemind.feedback.failed',
    requestId: safeString(requestId),
    status: Number(status) || 0,
    errorType: safeString(errorType),
    provider: safeString(provider),
    model: safeString(model),
    providerHost: safeString(providerHost)
  }
  if (typeof upstreamStatus === 'number') {
    out.upstreamStatus = Number(upstreamStatus)
  }
  emit(out)
}

function clean(value) {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : String(value)
}

function emit(payload) {
  try { console.log(JSON.stringify(payload)) } catch {}
}

export function logCopilotStarted({ requestId, executionId, environment, provider, model }) {
  emit({
    event: 'diagnostic.copilot.started',
    requestId: clean(requestId),
    executionId: clean(executionId),
    environment: clean(environment),
    provider: clean(provider),
    model: clean(model)
  })
}

export function logCopilotCompleted({ requestId, executionId, durationMs, provider, model }) {
  emit({
    event: 'diagnostic.copilot.completed',
    requestId: clean(requestId),
    executionId: clean(executionId),
    durationMs: Number(durationMs) || 0,
    provider: clean(provider),
    model: clean(model)
  })
}

export function logCopilotFailed({ requestId, executionId, durationMs, errorType, provider, model }) {
  emit({
    event: 'diagnostic.copilot.failed',
    requestId: clean(requestId),
    executionId: clean(executionId),
    durationMs: Number(durationMs) || 0,
    errorType: clean(errorType),
    provider: clean(provider),
    model: clean(model)
  })
}

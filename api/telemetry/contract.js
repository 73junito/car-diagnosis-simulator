'use strict'

const TELEMETRY_TTL_DAYS = 30
const MAX_SESSION_ID_LENGTH = 128
const MAX_SCENARIO_KEY_LENGTH = 128
const MAX_SYMPTOM_CATEGORY_LENGTH = 256

const ALLOWED_CLIENT_EVENT_TYPES = new Set([
  'scenario_started'
])

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'session_id',
  'event_type',
  'payload_json'
])

const ALLOWED_SCENARIO_STARTED_PAYLOAD_KEYS = new Set([
  'scenario_id',
  'scenario_key',
  'symptom_category'
])

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasOnlyKeys(obj, allowed) {
  return Object.keys(obj).every((key) => allowed.has(key))
}

function isBoundedString(value, maxLength, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') return false
  if (!allowEmpty && value.trim() === '') return false
  return value.length <= maxLength
}

function validateScenarioStartedPayload(payload) {
  if (!isPlainObject(payload)) {
    return { ok: false, error: 'payload_must_be_object' }
  }

  if (!hasOnlyKeys(payload, ALLOWED_SCENARIO_STARTED_PAYLOAD_KEYS)) {
    return { ok: false, error: 'payload_field_not_allowed' }
  }

  const scenarioId = payload.scenario_id
  const validScenarioId =
    (typeof scenarioId === 'number' && Number.isFinite(scenarioId)) ||
    isBoundedString(scenarioId, 128)

  if (!validScenarioId) {
    return { ok: false, error: 'scenario_id_required' }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'scenario_key') &&
    payload.scenario_key !== null &&
    !isBoundedString(payload.scenario_key, MAX_SCENARIO_KEY_LENGTH)
  ) {
    return { ok: false, error: 'invalid_scenario_key' }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'symptom_category') &&
    payload.symptom_category !== null &&
    !isBoundedString(payload.symptom_category, MAX_SYMPTOM_CATEGORY_LENGTH, { allowEmpty: true })
  ) {
    return { ok: false, error: 'invalid_symptom_category' }
  }

  return {
    ok: true,
    payload: {
      scenario_id: scenarioId,
      ...(payload.scenario_key !== undefined ? { scenario_key: payload.scenario_key } : {}),
      ...(payload.symptom_category !== undefined ? { symptom_category: payload.symptom_category } : {})
    }
  }
}

function validateClientTelemetryEvent(input) {
  if (!isPlainObject(input)) {
    return { ok: false, error: 'invalid_event' }
  }

  if (!hasOnlyKeys(input, ALLOWED_TOP_LEVEL_KEYS)) {
    return { ok: false, error: 'top_level_field_not_allowed' }
  }

  if (!isBoundedString(input.session_id, MAX_SESSION_ID_LENGTH)) {
    return { ok: false, error: 'invalid_session_id' }
  }

  if (!ALLOWED_CLIENT_EVENT_TYPES.has(input.event_type)) {
    return { ok: false, error: 'event_type_not_allowed' }
  }

  if (input.event_type === 'scenario_started') {
    const payloadResult = validateScenarioStartedPayload(input.payload_json)
    if (!payloadResult.ok) return payloadResult

    return {
      ok: true,
      event: {
        sessionId: input.session_id,
        eventType: input.event_type,
        payload: payloadResult.payload,
        source: 'telemetry'
      }
    }
  }

  return { ok: false, error: 'event_type_not_allowed' }
}

function isTelemetryRowExpired(row, nowMs = Date.now()) {
  if (!row || !row.expires_at) return false
  const expiresMs = Date.parse(row.expires_at)
  if (!Number.isFinite(expiresMs)) return true
  return expiresMs <= nowMs
}

module.exports = {
  TELEMETRY_TTL_DAYS,
  ALLOWED_CLIENT_EVENT_TYPES,
  validateClientTelemetryEvent,
  isTelemetryRowExpired
}

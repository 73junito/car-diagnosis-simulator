import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'

const MAX_BODY_BYTES = 10 * 1024
const MAX_SESSION_ID_LENGTH = 128
const MAX_SCENARIO_KEY_LENGTH = 128
const MAX_SYMPTOM_CATEGORY_LENGTH = 256

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

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

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

function validateTelemetryPayload(input) {
  if (!isPlainObject(input)) return { ok: false, error: 'invalid_event' }
  if (!hasOnlyKeys(input, ALLOWED_TOP_LEVEL_KEYS)) {
    return { ok: false, error: 'top_level_field_not_allowed' }
  }
  if (!isBoundedString(input.session_id, MAX_SESSION_ID_LENGTH)) {
    return { ok: false, error: 'invalid_session_id' }
  }
  if (input.event_type !== 'scenario_started') {
    return { ok: false, error: 'event_type_not_allowed' }
  }

  const payload = input.payload_json
  if (!isPlainObject(payload)) return { ok: false, error: 'payload_must_be_object' }
  if (!hasOnlyKeys(payload, ALLOWED_SCENARIO_STARTED_PAYLOAD_KEYS)) {
    return { ok: false, error: 'payload_field_not_allowed' }
  }

  const scenarioId = payload.scenario_id
  const validScenarioId =
    (typeof scenarioId === 'number' && Number.isFinite(scenarioId)) ||
    isBoundedString(scenarioId, 128)
  if (!validScenarioId) return { ok: false, error: 'scenario_id_required' }

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
    event: {
      session_id: input.session_id,
      event_type: 'scenario_started',
      payload_json: {
        scenario_id: scenarioId,
        ...(payload.scenario_key !== undefined ? { scenario_key: payload.scenario_key } : {}),
        ...(payload.symptom_category !== undefined ? { symptom_category: payload.symptom_category } : {})
      }
    }
  }
}

async function resolveOptionalUserId(c, supabaseUrl, serviceRoleKey) {
  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { userId: null }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user?.id) return { error: 'Authentication required' }
  return { userId: user.id }
}

export async function handleTelemetryEventIngest(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  let raw
  try {
    raw = await c.req.text()
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400)
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return c.json({ ok: false, error: 'payload_too_large' }, 413)
  }

  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    return c.json({ ok: false, error: 'invalid_json' }, 400)
  }

  const validation = validateTelemetryPayload(body)
  if (!validation.ok) {
    return c.json({ ok: false, error: validation.error }, 400)
  }

  const identity = await resolveOptionalUserId(c, supabaseUrl, serviceRoleKey)
  if (identity.error) {
    return c.json({ ok: false, error: identity.error }, 401)
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const row = {
    session_id: validation.event.session_id,
    user_id: identity.userId,
    event_type: validation.event.event_type,
    payload_json: validation.event.payload_json,
    source: 'telemetry'
  }

  const { error } = await supabase.from('telemetry_events').insert(row)
  if (error) {
    console.error('Telemetry ingestion failed:', error.message || error)
    return c.json({ ok: false, error: 'Unable to save telemetry' }, 500)
  }

  return c.json({ ok: true }, 202)
}

export { validateTelemetryPayload }

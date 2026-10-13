import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

const MAX_LIMIT = 50
const MAX_PAGE = 20
const ASSESSMENT_MODE = 'independent_non_proctored_assessment'
const PRACTICE_MODE = 'training'

function cleanLimit(value) {
  const parsed = Number.parseInt(value || '20', 10)
  if (!Number.isInteger(parsed)) return 20
  return Math.max(1, Math.min(parsed, MAX_LIMIT))
}

function cleanPage(value) {
  const parsed = Number.parseInt(value || '1', 10)
  if (!Number.isInteger(parsed)) return 1
  return Math.max(1, Math.min(parsed, MAX_PAGE))
}

function classifyAttempt(row) {
  if (row.delivery_mode === ASSESSMENT_MODE) return 'assessment'
  if (row.delivery_mode === PRACTICE_MODE) return 'practice'
  return 'learning'
}

function publicAttemptEvent(row) {
  const recordType = classifyAttempt(row)
  return {
    id: 'attempt:' + row.id,
    eventType: 'learning_record',
    recordType,
    scenarioId: row.scenario || null,
    status: row.completion_state || row.status || null,
    occurredAt: row.updated_at || row.created_at || null,
    source: 'attempts',
    message:
      recordType === 'assessment'
        ? 'Assessment learning record updated.'
        : recordType === 'practice'
          ? 'Practice learning record updated.'
          : 'Learning record updated.'
  }
}

function publicTelemetryEvent(row) {
  const payload = row.payload_json && typeof row.payload_json === 'object'
    ? row.payload_json
    : {}

  return {
    id: 'telemetry:' + row.id,
    eventType: 'scenario_started',
    recordType: 'scenario',
    scenarioId: payload.scenario_id ?? null,
    scenarioKey: typeof payload.scenario_key === 'string' ? payload.scenario_key : null,
    symptomCategory: typeof payload.symptom_category === 'string' ? payload.symptom_category : null,
    occurredAt: row.created_at || null,
    source: 'telemetry',
    message: 'Scenario started.'
  }
}

export async function handleStudentActivity(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return c.json({ error: 'Authentication required' }, 401)

  const { user, error: authError } = await verifySupabaseToken(
    token,
    supabaseUrl,
    serviceRoleKey
  )
  if (authError || !user?.id) {
    return c.json({ error: authError || 'Invalid token' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  const limit = cleanLimit(c.req.query('limit'))
  const page = cleanPage(c.req.query('page'))
  const offset = (page - 1) * limit
  const fetchCount = Math.min(offset + limit + 1, MAX_LIMIT * MAX_PAGE + 1)
  const now = new Date().toISOString()

  const [attemptResult, telemetryResult] = await Promise.all([
    supabase
      .from('attempts')
      .select('id,scenario,delivery_mode,status,completion_state,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(fetchCount),
    supabase
      .from('telemetry_events')
      .select('id,event_type,payload_json,created_at,expires_at')
      .eq('user_id', user.id)
      .eq('event_type', 'scenario_started')
      .or('expires_at.is.null,expires_at.gt.' + now)
      .order('created_at', { ascending: false })
      .limit(fetchCount)
  ])

  if (attemptResult.error || telemetryResult.error) {
    console.error(
      'Student activity lookup failed:',
      attemptResult.error?.message || telemetryResult.error?.message || attemptResult.error || telemetryResult.error
    )
    return c.json({ error: 'Unable to load recent activity' }, 500)
  }

  const events = [
    ...(attemptResult.data || []).map(publicAttemptEvent),
    ...(telemetryResult.data || []).map(publicTelemetryEvent)
  ]
    .filter((event) => event.occurredAt)
    .sort((a, b) => {
      const time = new Date(b.occurredAt) - new Date(a.occurredAt)
      if (time !== 0) return time
      return String(a.id).localeCompare(String(b.id))
    })

  const pageEvents = events.slice(offset, offset + limit)
  const hasMore = events.length > offset + limit

  return c.json({
    page,
    limit,
    hasMore,
    events: pageEvents,
    boundaries: {
      maxPage: MAX_PAGE,
      maxLimit: MAX_LIMIT,
      telemetryRetention: 'Expired telemetry rows are excluded using telemetry_events.expires_at.',
      attemptRetention: 'Learning-record retention follows the authoritative attempts table.'
    }
  }, 200)
}

export { cleanLimit, cleanPage, classifyAttempt, publicAttemptEvent, publicTelemetryEvent }

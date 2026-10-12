import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import { isInstructorRole, resolveTrustedRole } from '../auth/role-policy.js'

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

async function authorizeInstructor(c) {
  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: c.json({ error: 'Server configuration incomplete' }, 500) }
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Authentication required' }, 401) }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user?.id) return { response: c.json({ error: 'Authentication required' }, 401) }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const role = await resolveTrustedRole(user, supabase)
  if (!isInstructorRole(role)) {
    return { response: c.json({ error: 'Instructor access required' }, 403) }
  }

  return { user, role, supabase }
}

async function loadOwnedClassUserIds(auth, classId) {
  const { data: cls, error: classError } = await auth.supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('owner_id', auth.user.id)
    .maybeSingle()

  if (classError) return { error: classError }
  if (!cls) return { notFound: true }

  const { data: enrollments, error: enrollmentError } = await auth.supabase
    .from('enrollments')
    .select('user_id')
    .eq('class_id', cls.id)

  if (enrollmentError) return { error: enrollmentError }

  return {
    classId: cls.id,
    userIds: (enrollments || []).map((row) => row.user_id).filter(Boolean)
  }
}

function normalizeTelemetryEvent(row) {
  return {
    created_at: row.created_at,
    event_type: row.event_type,
    session_id: row.session_id,
    payload: row.payload_json || {}
  }
}

async function loadScopedTelemetry(auth, classId, sessionId, limit) {
  const scope = await loadOwnedClassUserIds(auth, classId)
  if (scope.error) return { error: scope.error }
  if (scope.notFound) return { notFound: true }
  if (scope.userIds.length === 0) return { classId: scope.classId, rows: [] }

  let query = auth.supabase
    .from('telemetry_events')
    .select('created_at,event_type,session_id,payload_json,user_id,expires_at')
    .in('user_id', scope.userIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) return { error }

  return {
    classId: scope.classId,
    rows: (data || []).map(normalizeTelemetryEvent)
  }
}

async function loadScopedTelemetrySince(auth, classId, since, limit) {
  const scope = await loadOwnedClassUserIds(auth, classId)
  if (scope.error) return { error: scope.error }
  if (scope.notFound) return { notFound: true }
  if (scope.userIds.length === 0) return { classId: scope.classId, rows: [] }

  let query = auth.supabase
    .from('telemetry_events')
    .select('created_at,event_type,session_id,payload_json,user_id,expires_at')
    .in('user_id', scope.userIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  if (since) query = query.gt('created_at', since)

  const { data, error } = await query
  if (error) return { error }

  return {
    classId: scope.classId,
    rows: (data || []).map(normalizeTelemetryEvent)
  }
}

function buildSseSnapshot(rows) {
  const lines = ['retry: 3000', '']
  for (const row of rows || []) {
    lines.push('event: telemetry')
    lines.push('data: ' + JSON.stringify(row))
    lines.push('')
  }
  return lines.join('\n') + '\n'
}

export async function handleInstructorTelemetryStream(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  const since = String(c.req.query('since') || '').trim()
  const requestedLimit = Number.parseInt(String(c.req.query('limit') || '100'), 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 250)
    : 100

  if (!classId) return c.json({ error: 'classId is required' }, 400)
  if (since && Number.isNaN(Date.parse(since))) {
    return c.json({ error: 'since must be an ISO timestamp' }, 400)
  }

  const result = await loadScopedTelemetrySince(auth, classId, since, limit)
  if (result.error) {
    console.error('Instructor telemetry stream lookup failed:', result.error.message || result.error)
    return c.json({ error: 'Unable to load telemetry stream' }, 500)
  }
  if (result.notFound) return c.json({ error: 'Class not found' }, 404)

  return new Response(buildSseSnapshot(result.rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Accel-Buffering': 'no'
    }
  })
}

function csvEscape(value) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

function buildTelemetryCsv(rows) {
  const header = ['created_at', 'event_type', 'session_id', 'payload']
  const body = (rows || []).map((row) => [
    row.created_at,
    row.event_type,
    row.session_id,
    JSON.stringify(row.payload || {})
  ])
  return [header, ...body].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

export async function handleInstructorTelemetryHistory(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  const sessionId = String(c.req.query('session') || c.req.query('sessionId') || '').trim()
  const requestedLimit = Number.parseInt(String(c.req.query('limit') || '50'), 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 50

  if (!classId) return c.json({ error: 'classId is required' }, 400)

  const result = await loadScopedTelemetry(auth, classId, sessionId, limit)
  if (result.error) {
    console.error('Instructor telemetry history lookup failed:', result.error.message || result.error)
    return c.json({ error: 'Unable to load telemetry history' }, 500)
  }
  if (result.notFound) return c.json({ error: 'Class not found' }, 404)

  return c.json({
    ok: true,
    classId: result.classId,
    data: result.rows
  }, 200)
}



export async function handleInstructorTelemetryExport(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const format = String(c.req.param('format') || '').trim().toLowerCase()
  const classId = String(c.req.query('classId') || '').trim()
  const sessionId = String(c.req.query('session') || c.req.query('sessionId') || '').trim()
  const requestedLimit = Number.parseInt(String(c.req.query('limit') || '50'), 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 50

  if (!classId) return c.json({ error: 'classId is required' }, 400)
  if (!['json', 'csv'].includes(format)) {
    return c.json({ error: 'format must be json or csv' }, 400)
  }

  const result = await loadScopedTelemetry(auth, classId, sessionId, limit)
  if (result.error) {
    console.error('Instructor telemetry export lookup failed:', result.error.message || result.error)
    return c.json({ error: 'Unable to export telemetry' }, 500)
  }
  if (result.notFound) return c.json({ error: 'Class not found' }, 404)

  if (format === 'csv') {
    return new Response(buildTelemetryCsv(result.rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="session-history.csv"',
        'Cache-Control': 'private, no-store'
      }
    })
  }

  return new Response(JSON.stringify({
    ok: true,
    classId: result.classId,
    data: result.rows
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="session-history.json"',
      'Cache-Control': 'private, no-store'
    }
  })
}

export { normalizeTelemetryEvent, buildTelemetryCsv, buildSseSnapshot }

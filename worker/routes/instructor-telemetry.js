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

  const scope = await loadOwnedClassUserIds(auth, classId)
  if (scope.error) {
    console.error('Instructor telemetry history scope lookup failed:', scope.error.message || scope.error)
    return c.json({ error: 'Unable to load telemetry history' }, 500)
  }
  if (scope.notFound) return c.json({ error: 'Class not found' }, 404)

  if (scope.userIds.length === 0) {
    return c.json({ ok: true, classId: scope.classId, data: [] }, 200)
  }

  let query = auth.supabase
    .from('telemetry_events')
    .select('created_at,event_type,session_id,payload_json,user_id,expires_at')
    .in('user_id', scope.userIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) {
    console.error('Instructor telemetry history lookup failed:', error.message || error)
    return c.json({ error: 'Unable to load telemetry history' }, 500)
  }

  return c.json({
    ok: true,
    classId: scope.classId,
    data: (data || []).map(normalizeTelemetryEvent)
  }, 200)
}

export { normalizeTelemetryEvent }

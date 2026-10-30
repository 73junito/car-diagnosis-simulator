import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import { isInstructorRole, resolveTrustedRole } from '../auth/role-policy.js'
import {
  resolveInstitutionScopeAccess,
  INSTITUTION_ACCESS_REFUSED,
  INSTITUTION_ACCESS_UNAVAILABLE
} from '../auth/institution-membership.js'

const MAX_SYSTEM_LENGTH = 120
const MAX_SCENARIOS_PER_ASSIGNMENT = 100
const MAX_STUDENTS_PER_ASSIGNMENT = 500

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

function normalizeSystem(value) {
  if (typeof value !== 'string') return null
  const system = value.trim()
  if (!system || system.length > MAX_SYSTEM_LENGTH) return null
  return system
}

function normalizeScenarioIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SCENARIOS_PER_ASSIGNMENT) {
    return null
  }

  const normalized = []
  const seen = new Set()
  for (const raw of value) {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null
    const id = typeof raw === 'string' ? raw.trim() : raw
    if (id === '') return null
    const key = `${typeof id}:${String(id)}`
    if (!seen.has(key)) {
      seen.add(key)
      normalized.push(id)
    }
  }
  return normalized
}

function normalizeStudentIds(value) {
  if (value == null) return null
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STUDENTS_PER_ASSIGNMENT) {
    return undefined
  }

  const normalized = []
  const seen = new Set()
  for (const raw of value) {
    if (typeof raw !== 'string') return undefined
    const id = raw.trim()
    if (!id) return undefined
    if (!seen.has(id)) {
      seen.add(id)
      normalized.push(id)
    }
  }
  return normalized
}

async function authorizeInstructor(c) {
  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: c.json({ error: 'Server configuration incomplete' }, 500) }
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user?.id) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const role = await resolveTrustedRole(user, supabase)
  if (!isInstructorRole(role)) {
    return { response: c.json({ error: 'Instructor access required' }, 403) }
  }

  return { user, role, supabase }
}

export async function handleCreateAssignment(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const system = normalizeSystem(body?.system)
  const scenarioIds = normalizeScenarioIds(body?.scenarioIds)
  const studentIds = normalizeStudentIds(body?.studentIds)
  const classId = typeof body?.classId === 'string' ? body.classId.trim() : ''

  if (!system || !scenarioIds || !classId || studentIds === undefined) {
    return c.json({
      error: 'system, non-empty scenarioIds, and classId are required; studentIds must be a non-empty string array when supplied'
    }, 400)
  }

  const { data: cls, error: classError } = await auth.supabase
    .from('classes')
    .select('id,institution_school_code')
    .eq('id', classId)
    .eq('owner_id', auth.user.id)
    .maybeSingle()

  if (classError) {
    console.error('Assignment class ownership check failed:', classError.message || classError)
    return c.json({ error: 'Unable to create assignment' }, 500)
  }
  if (!cls) return c.json({ error: 'Class not found' }, 404)

  // R26 Phase 2 / R1: revalidate current institution membership before validating enrollment
  // records or creating the assignment, so a suspended or revoked owner cannot reach students.
  const scope = await resolveInstitutionScopeAccess(auth, cls.institution_school_code)
  if (!scope.allowed) {
    if (scope.status === 503) {
      console.error('Assignment membership revalidation failed:', scope.reason)
      return c.json({ error: INSTITUTION_ACCESS_UNAVAILABLE }, 503)
    }
    console.warn('Assignment creation refused:', scope.reason, {
      classId: cls.id,
      userId: auth.user.id,
      institutionSchoolCode: cls.institution_school_code || null
    })
    return c.json({ error: INSTITUTION_ACCESS_REFUSED }, 403)
  }
  if (scope.unscoped) {
    console.warn('Assignment authorized by ownership alone:', scope.reason, { classId: cls.id })
  }

  if (studentIds) {
    const { data: enrollments, error: enrollmentError } = await auth.supabase
      .from('enrollments')
      .select('user_id')
      .eq('class_id', cls.id)
      .in('user_id', studentIds)

    if (enrollmentError) {
      console.error('Assignment enrollment validation failed:', enrollmentError.message || enrollmentError)
      return c.json({ error: 'Unable to create assignment' }, 500)
    }

    const enrolled = new Set((enrollments || []).map((row) => row.user_id))
    const invalidStudentIds = studentIds.filter((id) => !enrolled.has(id))
    if (invalidStudentIds.length > 0) {
      return c.json({ error: 'All targeted students must be enrolled in the class' }, 400)
    }
  }

  const payload = {
    system,
    scenario_ids: scenarioIds,
    assigned_to: studentIds,
    class_id: cls.id
  }

  const { data, error } = await auth.supabase
    .from('assignments')
    .insert(payload)
    .select('id,system,scenario_ids,assigned_to,class_id,created_at')
    .single()

  if (error) {
    console.error('Assignment create failed:', error.message || error)
    return c.json({ error: 'Unable to create assignment' }, 500)
  }

  return c.json({ success: true, assignment: data }, 201)
}

export {
  MAX_SYSTEM_LENGTH,
  MAX_SCENARIOS_PER_ASSIGNMENT,
  MAX_STUDENTS_PER_ASSIGNMENT,
  normalizeSystem,
  normalizeScenarioIds,
  normalizeStudentIds
}

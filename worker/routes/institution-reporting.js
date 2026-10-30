import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'

const REPORT_ROLES = new Set(['institution_admin', 'institution_owner'])
const ID_CHUNK_SIZE = 150

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

async function authorizeAuthenticated(c) {
  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: c.json({ error: 'Server configuration incomplete' }, 500) }
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Authentication required' }, 401) }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user?.id) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  return {
    user,
    supabase: createServiceClient(supabaseUrl, serviceRoleKey)
  }
}

function normalizeSchoolCode(value) {
  const schoolCode = String(value || '').trim().toUpperCase()
  return /^[A-Z0-9]{6}$/.test(schoolCode) ? schoolCode : null
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function chunks(values, size = ID_CHUNK_SIZE) {
  const rows = []
  for (let index = 0; index < values.length; index += size) {
    rows.push(values.slice(index, index + size))
  }
  return rows
}

async function loadActiveReportMembership(auth, schoolCode) {
  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,user_id,role,status')
    .eq('school_code', schoolCode)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) return { error }
  if (!data || !REPORT_ROLES.has(data.role)) return { forbidden: true }
  return { membership: data }
}

async function loadEnrollmentsByClassIds(supabase, classIds) {
  const rows = []
  for (const batch of chunks(classIds)) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('class_id,user_id')
      .in('class_id', batch)

    if (error) return { error }
    rows.push(...(data || []))
  }
  return { data: rows }
}

// Retained for reuse by callers that can supply class-attributed attempts. This
// route deliberately does not call it: see the attribution note in the report payload.
function summarizeAttempts(attempts) {
  const rows = Array.isArray(attempts) ? attempts : []
  const completed = rows.filter((attempt) => attempt.status === 'completed')
  const scored = completed
    .map((attempt) => Number(attempt.score))
    .filter(Number.isFinite)

  return {
    attempts: rows.length,
    completedAttempts: completed.length,
    completionRate: rows.length ? round((completed.length / rows.length) * 100) : null,
    averageScore: scored.length
      ? round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
      : null
  }
}

function buildRoleCounts(memberships) {
  const counts = {
    member: 0,
    instructor: 0,
    institution_admin: 0,
    institution_owner: 0
  }

  for (const membership of memberships || []) {
    if (membership.status === 'active' && Object.prototype.hasOwnProperty.call(counts, membership.role)) {
      counts[membership.role] += 1
    }
  }

  return counts
}

function buildClassSummaries(classes, enrollments) {
  const userIdsByClass = new Map()
  for (const enrollment of enrollments || []) {
    if (!userIdsByClass.has(enrollment.class_id)) userIdsByClass.set(enrollment.class_id, new Set())
    userIdsByClass.get(enrollment.class_id).add(enrollment.user_id)
  }

  return (classes || []).map((cls) => {
    const classUsers = userIdsByClass.get(cls.id) || new Set()

    return {
      classId: cls.id,
      name: cls.name,
      programId: cls.institution_program_id || null,
      cohortId: cls.institution_cohort_id || null,
      studentCount: classUsers.size,
      // Attempts currently have no trusted class/institution attribution.
      // Fail closed rather than treating a cross-institution learner's attempts as this class's.
      activity: null
    }
  })
}

export async function handleInstitutionAdminReport(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const schoolCode = normalizeSchoolCode(c.req.query('schoolCode'))
  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)

  const reportMembership = await loadActiveReportMembership(auth, schoolCode)
  if (reportMembership.error) {
    console.error('Institution report authorization failed:', reportMembership.error.message || reportMembership.error)
    return c.json({ error: 'Unable to authorize institution reporting' }, 500)
  }
  if (reportMembership.forbidden) {
    return c.json({ error: 'Institution administrator access required for institution reporting' }, 403)
  }

  const [
    membershipResult,
    programResult,
    cohortResult,
    classResult
  ] = await Promise.all([
    auth.supabase
      .from('institution_memberships')
      .select('role,status')
      .eq('school_code', schoolCode),
    auth.supabase
      .from('institution_programs')
      .select('id,active')
      .eq('school_code', schoolCode),
    auth.supabase
      .from('institution_cohorts')
      .select('id,program_id,active')
      .eq('school_code', schoolCode),
    auth.supabase
      .from('classes')
      .select('id,name,institution_program_id,institution_cohort_id,created_at')
      .eq('institution_school_code', schoolCode)
      .order('created_at', { ascending: true })
  ])

  const sourceError =
    membershipResult.error ||
    programResult.error ||
    cohortResult.error ||
    classResult.error

  if (sourceError) {
    console.error('Institution report tenant source lookup failed:', sourceError.message || sourceError)
    return c.json({ error: 'Unable to load institution report' }, 500)
  }

  const classes = classResult.data || []
  const classIds = classes.map((row) => row.id)
  let enrollments = []

  if (classIds.length) {
    const enrollmentResult = await loadEnrollmentsByClassIds(auth.supabase, classIds)
    if (enrollmentResult.error) {
      console.error('Institution report enrollment lookup failed:', enrollmentResult.error.message || enrollmentResult.error)
      return c.json({ error: 'Unable to load institution report' }, 500)
    }
    enrollments = enrollmentResult.data || []


  }

  const uniqueStudents = new Set(enrollments.map((row) => row.user_id).filter(Boolean))
  const programs = programResult.data || []
  const cohorts = cohortResult.data || []
  const memberships = membershipResult.data || []

  return c.json({
    schoolCode,
    generatedAt: new Date().toISOString(),
    actorRole: reportMembership.membership.role,
    scope: 'tenant_scoped_class_enrollment_population',
    interpretation: 'Operational learning activity only. This is not a transcript, credential, academic-credit record, or institutional grade report.',
    membershipCounts: buildRoleCounts(memberships),
    activeMemberships: memberships.filter((row) => row.status === 'active').length,
    programs: {
      total: programs.length,
      active: programs.filter((row) => row.active).length
    },
    cohorts: {
      total: cohorts.length,
      active: cohorts.filter((row) => row.active).length
    },
    classes: classes.length,
    enrollments: enrollments.length,
    uniqueStudents: uniqueStudents.size,
    // Unattributed assessment activity must not appear in a tenant-scoped report.
    activity: null,
    classSummaries: buildClassSummaries(classes, enrollments)
  }, 200)
}

export {
  summarizeAttempts,
  buildRoleCounts,
  buildClassSummaries
}

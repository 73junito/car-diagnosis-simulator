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

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function buildStudentAnalytics(enrollments, profiles, attempts, answers) {
  const profileById = new Map((profiles || []).map((row) => [row.id, row]))
  const attemptsByUser = new Map()
  const answersByAttempt = new Map()

  for (const answer of answers || []) {
    if (!answersByAttempt.has(answer.attempt_id)) answersByAttempt.set(answer.attempt_id, [])
    answersByAttempt.get(answer.attempt_id).push(answer)
  }

  for (const attempt of attempts || []) {
    if (!attemptsByUser.has(attempt.user_id)) attemptsByUser.set(attempt.user_id, [])
    attemptsByUser.get(attempt.user_id).push(attempt)
  }

  return (enrollments || []).map((enrollment) => {
    const userAttempts = attemptsByUser.get(enrollment.user_id) || []
    const completed = userAttempts.filter((attempt) => attempt.status === 'completed')
    const scored = completed.map((attempt) => Number(attempt.score)).filter(Number.isFinite)

    let correct = 0
    let answered = 0
    for (const attempt of completed) {
      for (const answer of answersByAttempt.get(attempt.id) || []) {
        answered += 1
        if (answer.is_correct === true) correct += 1
      }
    }

    const profile = profileById.get(enrollment.user_id)
    return {
      id: enrollment.user_id,
      name: profile?.email || enrollment.user_id,
      sessions: userAttempts.length,
      completedSessions: completed.length,
      averageScore: scored.length ? round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null,
      answerAccuracy: answered ? round((correct / answered) * 100) : null,
      averageConfidence: null
    }
  })
}

export async function handleInstructorStudentAnalytics(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  if (!classId) return c.json({ error: 'classId is required' }, 400)

  const { data: cls, error: classError } = await auth.supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('owner_id', auth.user.id)
    .maybeSingle()

  if (classError) {
    console.error('Instructor analytics class lookup failed:', classError.message || classError)
    return c.json({ error: 'Unable to load analytics' }, 500)
  }
  if (!cls) return c.json({ error: 'Class not found' }, 404)

  const { data: enrollments, error: enrollmentError } = await auth.supabase
    .from('enrollments')
    .select('user_id')
    .eq('class_id', cls.id)

  if (enrollmentError) {
    console.error('Instructor analytics enrollment lookup failed:', enrollmentError.message || enrollmentError)
    return c.json({ error: 'Unable to load analytics' }, 500)
  }

  const userIds = (enrollments || []).map((row) => row.user_id).filter(Boolean)
  if (userIds.length === 0) {
    return c.json({ ok: true, classId: cls.id, totalStudents: 0, students: [] }, 200)
  }

  const [{ data: profiles, error: profileError }, { data: attempts, error: attemptsError }] = await Promise.all([
    auth.supabase.from('profiles').select('id,email').in('id', userIds),
    auth.supabase
      .from('attempts')
      .select('id,user_id,status,score,created_at,updated_at')
      .in('user_id', userIds)
  ])

  if (profileError || attemptsError) {
    console.error('Instructor analytics student source lookup failed:', profileError?.message || attemptsError?.message || profileError || attemptsError)
    return c.json({ error: 'Unable to load analytics' }, 500)
  }

  const attemptIds = (attempts || []).map((row) => row.id).filter(Boolean)
  let answers = []
  if (attemptIds.length > 0) {
    const { data, error } = await auth.supabase
      .from('attempt_answers')
      .select('attempt_id,is_correct')
      .in('attempt_id', attemptIds)
      .in('user_id', userIds)

    if (error) {
      console.error('Instructor analytics answer lookup failed:', error.message || error)
      return c.json({ error: 'Unable to load analytics' }, 500)
    }
    answers = data || []
  }

  const students = buildStudentAnalytics(enrollments || [], profiles || [], attempts || [], answers)
  return c.json({
    ok: true,
    classId: cls.id,
    totalStudents: students.length,
    students
  }, 200)
}

export { buildStudentAnalytics }

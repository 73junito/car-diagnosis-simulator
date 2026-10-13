import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import { isInstructorRole, resolveTrustedRole } from '../auth/role-policy.js'
import instructorIntelligenceAgent from '../../src/ai/education/instructor-intelligence-agent.js'

const { prepareInstructorIntelligence } = instructorIntelligenceAgent

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

function buildSessionSummary(attempts) {
  const rows = Array.isArray(attempts) ? attempts : []
  const completed = rows.filter((attempt) => attempt.status === 'completed')
  const scored = completed.map((attempt) => Number(attempt.score)).filter(Number.isFinite)
  const durations = completed
    .map((attempt) => {
      const start = Date.parse(attempt.created_at || '')
      const end = Date.parse(attempt.updated_at || '')
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
      return (end - start) / 1000
    })
    .filter(Number.isFinite)

  return {
    totalSessions: rows.length,
    completedSessions: completed.length,
    averageScore: scored.length ? round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : null,
    completionRate: rows.length ? round((completed.length / rows.length) * 100) : null,
    averageTime: durations.length ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    averageConfidence: null,
    safetyMisses: null
  }
}

async function loadOwnedClassPopulation(auth, classId) {
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
    cls,
    enrollments: enrollments || [],
    userIds: (enrollments || []).map((row) => row.user_id).filter(Boolean)
  }
}

export async function handleInstructorSessionAnalytics(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  if (!classId) return c.json({ error: 'classId is required' }, 400)

  const scope = await loadOwnedClassPopulation(auth, classId)
  if (scope.error) {
    console.error('Instructor session analytics scope lookup failed:', scope.error.message || scope.error)
    return c.json({ error: 'Unable to load analytics' }, 500)
  }
  if (scope.notFound) return c.json({ error: 'Class not found' }, 404)

  if (scope.userIds.length === 0) {
    return c.json({
      ok: true,
      classId: scope.cls.id,
      ...buildSessionSummary([])
    }, 200)
  }

  const { data: attempts, error: attemptsError } = await auth.supabase
    .from('attempts')
    .select('id,user_id,status,score,created_at,updated_at')
    .in('user_id', scope.userIds)

  if (attemptsError) {
    console.error('Instructor session analytics attempt lookup failed:', attemptsError.message || attemptsError)
    return c.json({ error: 'Unable to load analytics' }, 500)
  }

  return c.json({
    ok: true,
    classId: scope.cls.id,
    ...buildSessionSummary(attempts || [])
  }, 200)
}


function csvEscape(value) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

function buildAnalyticsCsv(classId, profiles, attempts) {
  const profileById = new Map((profiles || []).map((row) => [row.id, row]))
  const header = [
    'classId',
    'studentId',
    'student',
    'scenario',
    'status',
    'score',
    'createdAt',
    'updatedAt'
  ]

  const rows = (attempts || []).map((attempt) => {
    const profile = profileById.get(attempt.user_id)
    return [
      classId,
      attempt.user_id,
      profile?.email || attempt.user_id,
      attempt.scenario,
      attempt.status,
      attempt.score,
      attempt.created_at,
      attempt.updated_at
    ]
  })

  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

function buildAnalyticsXapi(profiles, attempts) {
  const profileById = new Map((profiles || []).map((row) => [row.id, row]))
  return (attempts || []).map((attempt) => {
    const profile = profileById.get(attempt.user_id)
    const completed = attempt.status === 'completed'
    return {
      actor: {
        objectType: 'Agent',
        account: {
          homePage: 'https://app.autolearnpro.com',
          name: attempt.user_id
        },
        ...(profile?.email ? { name: profile.email } : {})
      },
      verb: {
        id: completed
          ? 'http://adlnet.gov/expapi/verbs/completed'
          : 'http://adlnet.gov/expapi/verbs/attempted',
        display: {
          'en-US': completed ? 'completed' : 'attempted'
        }
      },
      object: {
        id: 'https://app.autolearnpro.com/scenarios/' + encodeURIComponent(String(attempt.scenario || 'unknown')),
        objectType: 'Activity',
        definition: {
          name: {
            'en-US': String(attempt.scenario || 'Scenario')
          }
        }
      },
      result: {
        completion: completed,
        ...(Number.isFinite(Number(attempt.score))
          ? { score: { raw: Number(attempt.score) } }
          : {})
      },
      timestamp: attempt.updated_at || attempt.created_at
    }
  })
}

export async function handleInstructorAnalyticsExport(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  const format = String(c.req.query('format') || 'csv').trim().toLowerCase()
  if (!classId) return c.json({ error: 'classId is required' }, 400)
  if (!['csv', 'xapi'].includes(format)) {
    return c.json({ error: 'format must be csv or xapi' }, 400)
  }

  const scope = await loadOwnedClassPopulation(auth, classId)
  if (scope.error) {
    console.error('Instructor analytics export scope lookup failed:', scope.error.message || scope.error)
    return c.json({ error: 'Unable to export analytics' }, 500)
  }
  if (scope.notFound) return c.json({ error: 'Class not found' }, 404)

  let profiles = []
  let attempts = []
  if (scope.userIds.length > 0) {
    const [profilesResult, attemptsResult] = await Promise.all([
      auth.supabase.from('profiles').select('id,email').in('id', scope.userIds),
      auth.supabase
        .from('attempts')
        .select('id,user_id,scenario,status,score,created_at,updated_at')
        .in('user_id', scope.userIds)
    ])

    if (profilesResult.error || attemptsResult.error) {
      console.error(
        'Instructor analytics export source lookup failed:',
        profilesResult.error?.message || attemptsResult.error?.message || profilesResult.error || attemptsResult.error
      )
      return c.json({ error: 'Unable to export analytics' }, 500)
    }

    profiles = profilesResult.data || []
    attempts = attemptsResult.data || []
  }

  if (format === 'xapi') {
    const body = JSON.stringify(buildAnalyticsXapi(profiles, attempts), null, 2)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="xapi-statements.json"',
        'Cache-Control': 'private, no-store'
      }
    })
  }

  return new Response(buildAnalyticsCsv(scope.cls.id, profiles, attempts), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="student-performance.csv"',
      'Cache-Control': 'private, no-store'
    }
  })
}

export async function handleInstructorIntelligence(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  if (!classId) return c.json({ error: 'classId is required' }, 400)

  const scope = await loadOwnedClassPopulation(auth, classId)
  if (scope.error) {
    console.error('Instructor intelligence scope lookup failed:', scope.error.message || scope.error)
    return c.json({ error: 'Unable to prepare instructor intelligence' }, 500)
  }
  if (scope.notFound) return c.json({ error: 'Class not found' }, 404)

  if (scope.userIds.length === 0) {
    return c.json({
      ok: true,
      intelligence: prepareInstructorIntelligence({
        classId: scope.cls.id,
        totalStudents: 0,
        students: [],
        sessions: buildSessionSummary([])
      })
    }, 200)
  }

  const [{ data: attempts, error: attemptsError }, { data: profiles, error: profileError }] = await Promise.all([
    auth.supabase
      .from('attempts')
      .select('id,user_id,status,score,created_at,updated_at')
      .in('user_id', scope.userIds),
    auth.supabase
      .from('profiles')
      .select('id,email')
      .in('id', scope.userIds)
  ])

  if (attemptsError || profileError) {
    console.error(
      'Instructor intelligence source lookup failed:',
      attemptsError?.message || profileError?.message || attemptsError || profileError
    )
    return c.json({ error: 'Unable to prepare instructor intelligence' }, 500)
  }

  const attemptIds = (attempts || []).map((row) => row.id).filter(Boolean)
  let answers = []
  if (attemptIds.length) {
    const { data, error } = await auth.supabase
      .from('attempt_answers')
      .select('attempt_id,is_correct')
      .in('attempt_id', attemptIds)
      .in('user_id', scope.userIds)

    if (error) {
      console.error('Instructor intelligence answer lookup failed:', error.message || error)
      return c.json({ error: 'Unable to prepare instructor intelligence' }, 500)
    }
    answers = data || []
  }

  const students = buildStudentAnalytics(
    scope.enrollments || [],
    profiles || [],
    attempts || [],
    answers
  )

  return c.json({
    ok: true,
    intelligence: prepareInstructorIntelligence({
      classId: scope.cls.id,
      totalStudents: students.length,
      students,
      sessions: buildSessionSummary(attempts || [])
    })
  }, 200)
}

export async function handleInstructorStudentAnalytics(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = String(c.req.query('classId') || '').trim()
  if (!classId) return c.json({ error: 'classId is required' }, 400)

  const scope = await loadOwnedClassPopulation(auth, classId)
  if (scope.error) {
    console.error('Instructor analytics scope lookup failed:', scope.error.message || scope.error)
    return c.json({ error: 'Unable to load analytics' }, 500)
  }
  if (scope.notFound) return c.json({ error: 'Class not found' }, 404)

  const { cls, enrollments, userIds } = scope
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

export {
  buildStudentAnalytics,
  buildSessionSummary,
  buildAnalyticsCsv,
  prepareInstructorIntelligence,
  buildAnalyticsXapi
}

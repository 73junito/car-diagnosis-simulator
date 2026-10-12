import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

const ASSESSMENT_MODE = 'independent_non_proctored_assessment'
const PRACTICE_MODE = 'training'
const TERMINAL_STATES = new Set(['completed', 'complete', 'finished', 'finalized', 'graded', 'submitted'])

function classifyAttempt(row) {
  if (row.delivery_mode === ASSESSMENT_MODE) return 'assessment'
  if (row.delivery_mode === PRACTICE_MODE) return 'practice'
  return 'unclassified'
}

function isTerminalAttempt(row) {
  const status = String(row.status || '').trim().toLowerCase()
  const completion = String(row.completion_state || '').trim().toLowerCase()
  return TERMINAL_STATES.has(status) || TERMINAL_STATES.has(completion)
}

function roundPercent(correct, total) {
  if (!total) return null
  return Math.round((correct / total) * 10000) / 100
}

function publicAttempt(row, answerSummary) {
  const recordType = classifyAttempt(row)
  const terminal = isTerminalAttempt(row)
  const base = {
    id: row.id,
    scenarioId: row.scenario,
    recordType,
    deliveryMode: row.delivery_mode || null,
    workflowType: row.workflow_type || null,
    status: row.status || null,
    completionState: row.completion_state || null,
    completed: terminal,
    responseCount: answerSummary.responses,
    startedAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null
  }

  if (recordType === 'practice') {
    return {
      ...base,
      practiceAccuracyPct: roundPercent(answerSummary.correct, answerSummary.responses),
      assessmentScore: null
    }
  }

  if (recordType === 'assessment') {
    return {
      ...base,
      practiceAccuracyPct: null,
      assessmentScore: terminal && row.score != null ? Number(row.score) : null
    }
  }

  return {
    ...base,
    practiceAccuracyPct: null,
    assessmentScore: null
  }
}

export async function handleStudentTranscript(c) {
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

  const requestedLimit = Number.parseInt(c.req.query('limit') || '100', 10)
  const limit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 200))
    : 100

  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select('id,scenario,delivery_mode,workflow_type,status,score,completion_state,created_at,updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (attemptsError) {
    console.error('Student transcript attempt lookup failed:', attemptsError.message || attemptsError)
    return c.json({ error: 'Unable to load transcript' }, 500)
  }

  const rows = attempts || []
  if (!rows.length) {
    return c.json({
      summary: {
        totalRecords: 0,
        completedRecords: 0,
        practiceRecords: 0,
        assessmentRecords: 0,
        lastActivityAt: null
      },
      records: [],
      interpretation: {
        academicCredit: false,
        credential: false,
        statement: 'This is an AutoLearnPro learning-history view, not an academic transcript, credential, certificate, or record of institutional credit.'
      }
    }, 200)
  }

  const attemptIds = rows.map((row) => row.id)
  const { data: answers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('attempt_id,is_correct,submitted_at,created_at')
    .eq('user_id', user.id)
    .in('attempt_id', attemptIds)

  if (answersError) {
    console.error('Student transcript answer lookup failed:', answersError.message || answersError)
    return c.json({ error: 'Unable to load transcript' }, 500)
  }

  const byAttempt = new Map(
    attemptIds.map((attemptId) => [attemptId, { responses: 0, correct: 0 }])
  )

  for (const answer of answers || []) {
    const summary = byAttempt.get(answer.attempt_id)
    if (!summary) continue
    summary.responses += 1
    if (answer.is_correct === true) summary.correct += 1
  }

  const records = rows.map((row) =>
    publicAttempt(row, byAttempt.get(row.id) || { responses: 0, correct: 0 })
  )

  const recognized = records.filter((row) => row.recordType !== 'unclassified')
  const timestamps = records
    .map((row) => row.updatedAt || row.startedAt)
    .filter(Boolean)
    .sort()

  return c.json({
    summary: {
      totalRecords: recognized.length,
      completedRecords: recognized.filter((row) => row.completed).length,
      practiceRecords: recognized.filter((row) => row.recordType === 'practice').length,
      assessmentRecords: recognized.filter((row) => row.recordType === 'assessment').length,
      lastActivityAt: timestamps.length ? timestamps[timestamps.length - 1] : null
    },
    records,
    interpretation: {
      academicCredit: false,
      credential: false,
      statement: 'This is an AutoLearnPro learning-history view, not an academic transcript, credential, certificate, or record of institutional credit.'
    }
  }, 200)
}

export { classifyAttempt, isTerminalAttempt, publicAttempt }

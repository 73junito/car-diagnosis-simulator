/**
 * Hono route: GET /api/assessment-attempts/:attempt_id/questions
 *
 * Returns only the immutable server-assigned questions for an active
 * assessment attempt. Correct answers and explanations are never returned.
 */
import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleAssessmentAttemptQuestions(c) {
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const attemptId = c.req.param('attempt_id')
  if (!UUID_RE.test(attemptId || '')) {
    return c.json({ error: 'Invalid attempt_id' }, 400)
  }

  const supabaseUrl = c.env.SUPABASE_URL
  const supabaseServiceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return c.json({ error: 'Authentication required' }, 401)

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, supabaseServiceRoleKey)
  if (authError || !user) {
    return c.json({ error: authError || 'Invalid token' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('id, user_id, scenario, delivery_mode, status')
    .eq('id', attemptId)
    .single()

  if (attemptError || !attempt) return c.json({ error: 'Attempt not found' }, 404)
  if (attempt.user_id !== user.id) return c.json({ error: 'Not authorized for this attempt' }, 403)
  if (attempt.delivery_mode !== 'independent_non_proctored_assessment') {
    return c.json({ error: 'Attempt is not an assessment attempt' }, 400)
  }
  if (attempt.status !== 'active') return c.json({ error: 'Attempt is not active' }, 409)

  const { data: assignments, error: assignmentError } = await supabase
    .from('attempt_questions')
    .select('question_id, sequence')
    .eq('attempt_id', attemptId)
    .order('sequence', { ascending: true })

  if (assignmentError) return c.json({ error: 'Failed to load assigned questions' }, 500)
  if (!assignments || assignments.length === 0) {
    return c.json({ error: 'Attempt has no assigned questions' }, 409)
  }

  const questionIds = assignments.map((row) => row.question_id)

  // Re-check the explicit eligibility registry at read time so a revoked item
  // fails closed even if it had been assigned before revocation.
  const { data: eligibility, error: eligibilityError } = await supabase
    .from('assessment_question_eligibility')
    .select('question_id, scenario_id, eligibility_status')
    .in('question_id', questionIds)
    .eq('eligibility_status', 'approved')

  if (eligibilityError || !eligibility || eligibility.length !== questionIds.length) {
    return c.json({ error: 'Assessment eligibility gate not satisfied' }, 409)
  }

  if (eligibility.some((row) => row.scenario_id !== attempt.scenario)) {
    return c.json({ error: 'Assigned question scenario mismatch' }, 409)
  }

  const { data: questions, error: questionsError } = await supabase
    .from('scenario_questions')
    .select(`
      id,
      question_id,
      scenario_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      difficulty,
      topic,
      competency_area_id
    `)
    .in('id', questionIds)

  if (questionsError || !questions) {
    return c.json({ error: 'Failed to load assigned question content' }, 500)
  }

  const questionMap = new Map(questions.map((question) => [question.id, question]))
  const ordered = assignments.map((assignment) => questionMap.get(assignment.question_id)).filter(Boolean)

  if (ordered.length !== assignments.length || ordered.some((question) => question.scenario_id !== attempt.scenario)) {
    return c.json({ error: 'Assigned question content failed validation' }, 409)
  }

  return c.json({
    attempt_id: attempt.id,
    scenario_id: attempt.scenario,
    delivery_mode: attempt.delivery_mode,
    count: ordered.length,
    questions: ordered
  }, 200)
}
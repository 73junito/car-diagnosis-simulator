/**
 * Hono route: POST /api/scenario-submissions/grade
 *
 * Protected endpoint for server-side answer grading:
 * - Requires Supabase JWT authentication
 * - Verifies answer against database-authoritative correct answer
 * - Never exposes correct_answer to client
 * - Records graded attempt
 * - Enforces assessment mode restrictions (no AI assistance)
 */
import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

export async function handleGradeScenarioSubmission(c) {
  if (c.req.method !== 'POST') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = c.env.SUPABASE_URL
  const supabaseServiceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase environment variables')
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  // 1. Require JWT authentication
  const authHeader = c.req.header('authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, supabaseServiceRoleKey)

  if (authError || !user) {
    return c.json({ error: authError || 'Invalid token' }, 401)
  }

  const userId = user.id

  // 2. Parse and validate request body
  let body
  try {
    body = await c.req.json()
  } catch (err) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    attempt_id,
    scenario_id,
    question_id,
    student_answer,
    delivery_mode
  } = body

  if (!attempt_id || !scenario_id || !question_id || !student_answer) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  if (!['training', 'independent_non_proctored_assessment'].includes(delivery_mode)) {
    return c.json({ error: 'Invalid delivery_mode' }, 400)
  }

  // Validate student_answer format (A, B, C, or D)
  if (!/^[ABCD]$/.test(student_answer)) {
    return c.json({ error: 'Invalid student_answer format' }, 400)
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 3. Fetch question with correct answer
    // NOTE: Only service role can fetch correct_answer; never exposed to student client
    const { data: question, error: questionError } = await supabase
      .from('scenario_questions')
      .select('id, scenario_id, correct_answer, explanation')
      .eq('id', question_id)
      .single()

    if (questionError || !question) {
      return c.json({ error: 'Question not found' }, 404)
    }

    // Verify question belongs to the requested scenario
    if (question.scenario_id !== scenario_id) {
      return c.json({ error: 'Question does not belong to this scenario' }, 400)
    }

    // 4. Verify attempt exists and belongs to authenticated user
    // Select payload_json (contains assessment metadata) and other attempt fields
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('id, user_id, delivery_mode, payload_json')
      .eq('id', attempt_id)
      .single()

    if (attemptError || !attempt) {
      return c.json({ error: 'Attempt not found' }, 404)
    }

    // Security: Verify attempt belongs to authenticated user
    if (attempt.user_id !== userId) {
      return c.json({ error: 'Not authorized to grade this attempt' }, 403)
    }

    // Security: Verify delivery_mode matches
    if (attempt.delivery_mode !== delivery_mode) {
      return c.json({ error: 'Delivery mode mismatch' }, 400)
    }

    // Extract assessment metadata from payload_json
    const aiAssistanceAllowed = attempt.payload_json?.ai_assistance_allowed === true

    // 5. Grade the answer (server-side only)
    const isCorrect = student_answer === question.correct_answer

    // 6. Record the submission in attempt_answers table
    // NOTE: This creates an audit trail; answers are immutable once recorded
    const { error: recordError } = await supabase
      .from('attempt_answers')
      .insert({
        attempt_id,
        question_id,
        user_id: userId,
        student_answer,
        is_correct: isCorrect,
        submitted_at: new Date().toISOString()
      })

    if (recordError) {
      console.error('Failed to record submission:', recordError)
      return c.json({ error: 'Failed to record submission' }, 500)
    }

    // 7. Return result WITHOUT exposing correct_answer or immediate correctness feedback
    // During assessment mode, suppress immediate feedback until attempt is finalized
    const aiAssistanceAvailable =
      attempt.delivery_mode !== 'independent_non_proctored_assessment' &&
      aiAssistanceAllowed !== true

    // In assessment mode: only confirm submission accepted (no feedback)
    // In training mode: provide full feedback including is_correct
    const response = {
      question_id,
      accepted: true,
      ai_assistance_available: aiAssistanceAvailable,
      metadata: {
        delivery_mode,
        graded_at: new Date().toISOString(),
        server_verified: true
      }
    }

    // Only include correctness feedback in training mode
    if (delivery_mode === 'training') {
      response.is_correct = isCorrect
      response.explanation = question.explanation
    }

    return c.json(response, 200)
  } catch (err) {
    console.error('Submission grading failed:', err)
    return c.json({ error: 'Grading failed' }, 500)
  }
}

/**
 * API endpoint: POST /api/scenario-submissions/grade
 *
 * Protected endpoint for server-side answer grading:
 * - Requires Supabase JWT authentication
 * - Verifies answer against database-authoritative correct answer
 * - Never exposes correct_answer to client
 * - Records graded attempt
 * - Enforces assessment mode restrictions (no AI assistance)
 *
 * Request body:
 * {
 *   "attempt_id": "uuid",
 *   "scenario_id": "scenario-key",
 *   "question_id": "question-uuid",
 *   "student_answer": "A|B|C|D",
 *   "delivery_mode": "training|independent_non_proctored_assessment"
 * }
 *
 * Response:
 * {
 *   "question_id": "uuid",
 *   "is_correct": boolean,
 *   "explanation": "...",
 *   "ai_assistance_available": boolean (false during assessment)
 * }
 */
const { createClient } = require('@supabase/supabase-js');
const { extractBearerToken, verifySupabaseToken } = require('../_utils/auth-utils');
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration incomplete' });
  }
  // 1. Require JWT authentication
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, supabaseServiceRoleKey);
  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Invalid token' });
  }
  const userId = user.id;
  // 2. Parse and validate request body
  const {
    attempt_id,
    scenario_id,
    question_id,
    student_answer,
    delivery_mode
  } = req.body;
  if (!attempt_id || !scenario_id || !question_id || !student_answer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['training', 'independent_non_proctored_assessment'].includes(delivery_mode)) {
    return res.status(400).json({ error: 'Invalid delivery_mode' });
  }
  // Validate student_answer format (A, B, C, or D)
  if (!/^[ABCD]$/.test(student_answer)) {
    return res.status(400).json({ error: 'Invalid student_answer format' });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    // 3. Fetch question with correct answer
    // NOTE: Only service role can fetch correct_answer; never exposed to student client
    const { data: question, error: questionError } = await supabase
      .from('scenario_questions')
      .select('id, scenario_id, correct_answer, explanation')
      .eq('id', question_id)
      .single();
    if (questionError || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    // Verify question belongs to the requested scenario
    if (question.scenario_id !== scenario_id) {
      return res.status(400).json({ error: 'Question does not belong to this scenario' });
    }
    // 4. Verify attempt exists and belongs to authenticated user
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('id, user_id, scenario, delivery_mode, status, payload_json')
      .eq('id', attempt_id)
      .single();
    if (attemptError || !attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    // Security: Verify attempt belongs to authenticated user
    if (attempt.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to grade this attempt' });
    }
    // Security: Verify attempt is active (not completed or abandoned)
    if (attempt.status !== 'active') {
      return res.status(409).json({ error: 'Attempt is not active' });
    }
    // Security: Verify attempt scenario matches requested scenario
    if (attempt.scenario !== scenario_id) {
      return res.status(400).json({ error: 'Attempt does not belong to this scenario' });
    }
    // Security: Verify delivery_mode matches
    if (attempt.delivery_mode !== delivery_mode) {
      return res.status(400).json({ error: 'Delivery mode mismatch' });
    }
    // Extract assessment metadata from payload
    const ai_assistance_allowed = attempt.payload_json?.ai_assistance_allowed !== true;
    // 5. Grade the answer (server-side only)
    const isCorrect = student_answer === question.correct_answer;
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
      });
    if (recordError) {
      console.error('Failed to record submission:', recordError);
      return res.status(500).json({ error: 'Failed to record submission' });
    }
    // 7. Return result WITHOUT exposing correct_answer or immediate correctness feedback
    // During assessment mode, suppress immediate feedback until attempt is finalized
    const aiAssistanceAvailable =
      attempt.delivery_mode !== 'independent_non_proctored_assessment' &&
      attempt.ai_assistance_allowed !== false;
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
    };
    // Only include correctness feedback in training mode
    if (delivery_mode === 'training') {
      response.is_correct = isCorrect;
      response.explanation = question.explanation;
    }
    return res.status(200).json(response);
  } catch (err) {
    console.error('Submission grading failed:', err);
    return res.status(500).json({ error: 'Grading failed' });
  }
}

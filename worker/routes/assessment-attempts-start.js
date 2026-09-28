/**
 * Hono route: POST /api/assessment-attempts/start
 *
 * Protected endpoint for initiating assessment attempts:
 * - Requires Supabase JWT authentication
 * - Records explicit learner attestation
 * - Creates immutable attempt record with assessment metadata
 * - Returns URL to assessment scenario
 */
import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

export async function handleStartAssessmentAttempt(c) {
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
  const userEmail = user.email

  // 2. Parse and validate request body
  let body
  try {
    body = await c.req.json()
  } catch (err) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    delivery_mode,
    learner_attestation,
    attestation_timestamp
  } = body

  if (delivery_mode !== 'independent_non_proctored_assessment') {
    return c.json({ error: 'Invalid delivery_mode' }, 400)
  }

  if (learner_attestation !== true) {
    return c.json({ error: 'Learner attestation required' }, 400)
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 3. Atomically create the attempt and bind the server-selected question set.
    // The database function fails closed unless explicit assessment eligibility
    // AND the provenance/citation approval chain are both satisfied.
    const scenarioId = 'no-crank'
    const { data: attemptId, error: createError } = await supabase.rpc('start_assessment_attempt_v1', {
      p_user_id: userId,
      p_scenario: scenarioId,
      p_payload_json: assessmentMetadata,
      p_question_count: 20
    })

    if (createError || !attemptId) {
      const message = String(createError?.message || '')
      if (message.includes('assessment_bank_not_ready')) {
        return c.json({ error: 'Assessment bank is not approved and ready for delivery' }, 409)
      }
      console.error('Failed to create assessment attempt:', createError)
      return c.json({ error: 'Failed to create assessment attempt' }, 500)
    }

    // 4. Return attempt ID and launch URL. Question selection remains server-side.
    const launchUrl = `/dashboard/student/scenario/?id=${scenarioId}&mode=assessment&attempt_id=${attemptId}`

    return c.json(
      {
        attempt_id: attemptId,
        launch_url: launchUrl,
        metadata: {
          delivery_mode: 'independent_non_proctored_assessment',
          ai_assistance_allowed: false,
          started_at: assessmentMetadata.started_at
        }
      },
      201
    )
  } catch (err) {
    console.error('Assessment startup failed:', err)
    return c.json({ error: 'Failed to start assessment' }, 500)
  }
}

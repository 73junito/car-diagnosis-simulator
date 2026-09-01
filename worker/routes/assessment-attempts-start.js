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

    // 3. Create assessment attempt record
    // This is immutable once created; only modifications allowed are answer submissions
    // Assessment metadata stored in payload_json to avoid schema expansion
    const assessmentMetadata = {
      user_email: userEmail,
      delivery_mode: 'independent_non_proctored_assessment',
      ai_assistance_allowed: false,
      counts_as_official_assessment: true,
      assessment_version: 'ADF-2026.1',
      learner_attestation: true,
      attestation_timestamp: attestation_timestamp || new Date().toISOString(),
      attestation_verified: true, // Set server-side from JWT verification
      started_at: new Date().toISOString()
    }

    const { data: attempt, error: createError } = await supabase
      .from('attempts')
      .insert({
        user_id: userId,
        scenario: 'no-crank', // Required, NOT NULL
        delivery_mode: 'independent_non_proctored_assessment',
        workflow_type: 'scenario_diagnostic',
        status: 'active', // Active, not in_progress (CHECK constraint only allows active|completed|abandoned)
        payload_json: assessmentMetadata // Store assessment metadata as JSON
      })
      .select()
      .single()

    if (createError || !attempt) {
      console.error('Failed to create attempt:', createError)
      return c.json({ error: 'Failed to create assessment attempt' }, 500)
    }

    // 4. Return attempt ID and launch URL
    const scenarioId = 'no-crank'
    const launchUrl = `/dashboard/student/scenario/?id=${scenarioId}&mode=assessment&attempt_id=${attempt.id}`

    return c.json(
      {
        attempt_id: attempt.id,
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

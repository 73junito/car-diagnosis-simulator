/**
 * API endpoint: POST /api/assessment-attempts/start
 *
 * Protected endpoint for initiating assessment attempts:
 * - Requires Supabase JWT authentication
 * - Records explicit learner attestation
 * - Creates immutable attempt record with assessment metadata
 * - Returns URL to assessment scenario
 *
 * Request body:
 * {
 *   "delivery_mode": "independent_non_proctored_assessment",
 *   "learner_attestation": true,
 *   "attestation_timestamp": "ISO-8601"
 * }
 *
 * Response:
 * {
 *   "attempt_id": "uuid",
 *   "launch_url": "/dashboard/student/scenario/?id=no-crank&mode=assessment&attempt_id=..."
 * }
 */

const { createClient } = require('@supabase/supabase-js');
const { extractBearerToken, verifySupabaseToken } = require('./_utils/auth-utils');

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
  const userEmail = user.email;

  // 2. Parse and validate request body
  const {
    delivery_mode,
    learner_attestation,
    attestation_timestamp
  } = req.body;

  if (delivery_mode !== 'independent_non_proctored_assessment') {
    return res.status(400).json({ error: 'Invalid delivery_mode' });
  }

  if (learner_attestation !== true) {
    return res.status(400).json({ error: 'Learner attestation required' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 3. Create assessment attempt record
    // This is immutable once created; only modifications allowed are answer submissions
    const { data: attempt, error: createError } = await supabase
      .from('attempts')
      .insert({
        user_id: userId,
        user_email: userEmail,
        delivery_mode: 'independent_non_proctored_assessment',
        ai_assistance_allowed: false,
        counts_as_official_assessment: true,
        assessment_version: 'ADF-2026.1',
        learner_attestation: true,
        attestation_timestamp: attestation_timestamp || new Date().toISOString(),
        attestation_verified: true, // Set server-side from JWT verification
        started_at: new Date().toISOString(),
        status: 'in_progress'
      })
      .select()
      .single();

    if (createError || !attempt) {
      console.error('Failed to create attempt:', createError);
      return res.status(500).json({ error: 'Failed to create assessment attempt' });
    }

    // 4. Return attempt ID and launch URL
    // For now, select the first available scenario; in production, this would be parameterized
    const scenarioId = 'no-crank'; // Default scenario for assessment
    const launchUrl = `/dashboard/student/scenario/?id=${scenarioId}&mode=assessment&attempt_id=${attempt.id}`;

    return res.status(201).json({
      attempt_id: attempt.id,
      launch_url: launchUrl,
      metadata: {
        delivery_mode: 'independent_non_proctored_assessment',
        ai_assistance_allowed: false,
        started_at: attempt.started_at
      }
    });
  } catch (err) {
    console.error('Assessment startup failed:', err);
    return res.status(500).json({ error: 'Failed to start assessment' });
  }
}

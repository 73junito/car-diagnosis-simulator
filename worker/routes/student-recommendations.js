import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'
import { buildStudentProgress } from '../../api/_utils/student-progress.js'
import studentCoachAgent from '../../src/ai/education/student-coach-agent.js'

const { prepareStudentCoachSummary } = studentCoachAgent

const PRACTICE_MODE = 'training'
const MAX_RECOMMENDATIONS = 3

function toRecommendation(row) {
  return {
    scenario_id: row.scenario_id,
    reason: 'Your aggregate practice history suggests revisiting this scenario before moving on.',
    action: 'practice',
    provenance: {
      source: 'training_progress',
      basis: 'aggregate_practice_performance',
      generatedBy: 'server_rule'
    }
  }
}

export async function handleStudentRecommendations(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return c.json({ error: 'Authentication required' }, 401)

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
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

  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select('id,scenario,status,created_at,updated_at')
    .eq('user_id', user.id)
    .eq('delivery_mode', PRACTICE_MODE)

  if (attemptsError) {
    console.error('Student recommendation attempt lookup failed:', attemptsError.message || attemptsError)
    return c.json({ error: 'Unable to load recommendations' }, 500)
  }

  const attemptRows = Array.isArray(attempts) ? attempts : []
  const attemptIds = attemptRows.map((row) => row.id).filter(Boolean)

  if (!attemptIds.length) {
    const recommendations = []
    return c.json({
      recommendations,
      state: 'insufficient_training_history',
      coachSummary: prepareStudentCoachSummary({
        recommendations,
        state: 'insufficient_training_history'
      }),
      context: {
        source: 'training_progress',
        assessmentDataUsed: false,
        statement: 'Recommendations are based only on your server-recorded training activity.'
      }
    }, 200)
  }

  const { data: answers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('attempt_id,is_correct,submitted_at,created_at')
    .eq('user_id', user.id)
    .in('attempt_id', attemptIds)

  if (answersError) {
    console.error('Student recommendation answer lookup failed:', answersError.message || answersError)
    return c.json({ error: 'Unable to load recommendations' }, 500)
  }

  const progress = buildStudentProgress(attemptRows, answers || [])
  const performance = Array.isArray(progress.performance) ? progress.performance : []

  if (!performance.length) {
    const recommendations = []
    return c.json({
      recommendations,
      state: 'insufficient_training_history',
      coachSummary: prepareStudentCoachSummary({
        recommendations,
        state: 'insufficient_training_history'
      }),
      context: {
        source: 'training_progress',
        assessmentDataUsed: false,
        statement: 'Recommendations are based only on your server-recorded training activity.'
      }
    }, 200)
  }

  const recommendations = performance.slice(0, MAX_RECOMMENDATIONS).map(toRecommendation)
  return c.json({
    recommendations,
    state: 'available',
    coachSummary: prepareStudentCoachSummary({
      recommendations,
      state: 'available'
    }),
    context: {
      source: 'training_progress',
      assessmentDataUsed: false,
      statement: 'Recommendations are generated from aggregate server-recorded training performance and are not grades or assessment decisions.'
    }
  }, 200)
}

export { toRecommendation }

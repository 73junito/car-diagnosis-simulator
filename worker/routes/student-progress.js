import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'
import { buildStudentProgress } from '../../api/_utils/student-progress.js'

export async function handleStudentProgress(c) {
  const supabaseUrl = c.env.SUPABASE_URL
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return c.json({ error: 'Authentication required' }, 401)

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (authError || !user) return c.json({ error: authError || 'Invalid token' }, 401)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select('id,scenario,status,created_at,updated_at')
    .eq('user_id', user.id)

  if (attemptsError) return c.json({ error: 'Failed to load progress' }, 500)

  const attemptIds = Array.isArray(attempts) ? attempts.map((row) => row.id).filter(Boolean) : []
  if (attemptIds.length === 0) return c.json({ performance: [], transcript: null }, 200)

  const { data: answers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('attempt_id,is_correct,submitted_at,created_at')
    .eq('user_id', user.id)
    .in('attempt_id', attemptIds)

  if (answersError) return c.json({ error: 'Failed to load progress' }, 500)

  return c.json(buildStudentProgress(attempts, answers), 200)
}

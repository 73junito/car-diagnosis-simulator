const { createClient } = require('@supabase/supabase-js')
const { extractBearerToken, verifySupabaseToken } = require('../_utils/auth-utils')
const { buildStudentProgress } = require('../_utils/student-progress')

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration incomplete' })
  }

  const token = extractBearerToken(req.headers.authorization)
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (authError || !user) return res.status(401).json({ error: authError || 'Invalid token' })

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: attempts, error: attemptsError } = await supabase
    .from('attempts')
    .select('id,scenario,status,created_at,updated_at')
    .eq('user_id', user.id)

  if (attemptsError) return res.status(500).json({ error: 'Failed to load progress' })

  const attemptIds = Array.isArray(attempts) ? attempts.map((row) => row.id).filter(Boolean) : []
  if (attemptIds.length === 0) {
    return res.status(200).json({ performance: [], transcript: null })
  }

  const { data: answers, error: answersError } = await supabase
    .from('attempt_answers')
    .select('attempt_id,is_correct,submitted_at,created_at')
    .eq('user_id', user.id)
    .in('attempt_id', attemptIds)

  if (answersError) return res.status(500).json({ error: 'Failed to load progress' })

  return res.status(200).json(buildStudentProgress(attempts, answers))
}

import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

const LIMIT = 5

function isLegacyTableMissing(error) {
  const code = error && error.code
  const message = String((error && error.message) || '')
  return code === '42P01' || code === 'PGRST205' || /student_recommendations.*(not found|does not exist)/i.test(message)
}

export async function handleStudentRecommendations(c) {
  const supabaseUrl = c.env.SUPABASE_URL
  const serviceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return c.json({ error: 'Authentication required' }, 401)

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (authError || !user) {
    return c.json({ error: authError || 'Invalid token' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await supabase
    .from('student_recommendations')
    .select('scenario_id,reason,priority')
    .eq('student_id', 'anonymous')
    .order('priority', { ascending: true })
    .limit(LIMIT)

  if (error) {
    if (isLegacyTableMissing(error)) return c.json({ recommendations: [] }, 200)
    return c.json({ error: 'Failed to load recommendations' }, 500)
  }

  return c.json({
    recommendations: Array.isArray(data)
      ? data.map((row) => ({
          scenario_id: row.scenario_id,
          reason: row.reason,
          priority: row.priority
        }))
      : []
  }, 200)
}

const { createClient } = require('@supabase/supabase-js')
const { extractBearerToken, verifySupabaseToken } = require('../_utils/auth-utils')

const LIMIT = 5

function isLegacyTableMissing(error) {
  const code = error && error.code
  const message = String((error && error.message) || '')
  return code === '42P01' || code === 'PGRST205' || /student_recommendations.*(not found|does not exist)/i.test(message)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration incomplete' })
  }

  const token = extractBearerToken(req.headers.authorization)
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const { user, error: authError } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Invalid token' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await supabase
    .from('student_recommendations')
    .select('scenario_id,reason,priority')
    .eq('student_id', 'anonymous')
    .order('priority', { ascending: true })
    .limit(LIMIT)

  if (error) {
    if (isLegacyTableMissing(error)) return res.status(200).json({ recommendations: [] })
    console.error('Failed to load student recommendations:', error)
    return res.status(500).json({ error: 'Failed to load recommendations' })
  }

  return res.status(200).json({
    recommendations: Array.isArray(data)
      ? data.map((row) => ({
          scenario_id: row.scenario_id,
          reason: row.reason,
          priority: row.priority
        }))
      : []
  })
}

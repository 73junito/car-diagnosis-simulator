import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'

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

  return c.json({ recommendations: [] }, 200)
}

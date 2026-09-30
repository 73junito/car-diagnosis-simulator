const { extractBearerToken, verifySupabaseToken } = require('../_utils/auth-utils')

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

  return res.status(200).json({ recommendations: [] })
}

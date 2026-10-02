import { createClient } from '@supabase/supabase-js'

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .replace(/[%_]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

export async function handleInstitutionSearch(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const query = normalizeSearch(c.req.query('q'))
  if (query.length < 2) {
    return c.json({ institutions: [] }, 200)
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await supabase
    .from('institutions')
    .select('school_code,school_name,city,state_code,country')
    .eq('active', true)
    .ilike('school_name', `%${query}%`)
    .order('school_name', { ascending: true })
    .limit(10)

  if (error) {
    console.error('Institution search failed:', error.message || error)
    return c.json({ error: 'Institution search unavailable' }, 503)
  }

  return c.json({
    institutions: (data || []).map((row) => ({
      schoolCode: row.school_code,
      schoolName: row.school_name,
      city: row.city,
      stateCode: row.state_code,
      country: row.country
    }))
  }, 200)
}

export { normalizeSearch }

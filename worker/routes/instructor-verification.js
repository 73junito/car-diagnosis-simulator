import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'

function normalizeSchoolCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

async function authorize(c) {
  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: c.json({ error: 'Server configuration incomplete' }, 500) }
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user?.id) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  return {
    user,
    supabase: createServiceClient(supabaseUrl, serviceRoleKey)
  }
}

function publicInstitution(row) {
  if (!row) return null
  return {
    schoolCode: row.school_code,
    schoolName: row.school_name,
    address: row.address,
    city: row.city,
    stateCode: row.state_code,
    zipCode: row.zip_code,
    province: row.province,
    country: row.country,
    postalCode: row.postal_code
  }
}

export async function handleInstitutionLookup(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  const schoolCode = normalizeSchoolCode(c.req.query('school_code'))
  if (!/^[A-Z0-9]{6}$/.test(schoolCode)) {
    return c.json({ error: 'Enter a valid six-character Federal School Code' }, 400)
  }

  const { data, error } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,address,city,state_code,zip_code,province,country,postal_code')
    .eq('school_code', schoolCode)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    console.error('Institution lookup failed:', error.message || error)
    return c.json({ error: 'Institution directory unavailable' }, 503)
  }
  if (!data) return c.json({ error: 'School code not recognized' }, 404)

  return c.json({ institution: publicInstitution(data) }, 200)
}

export async function handleInstructorVerificationRequest(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const schoolCode = normalizeSchoolCode(body?.schoolCode)
  if (!/^[A-Z0-9]{6}$/.test(schoolCode)) {
    return c.json({ error: 'Enter a valid six-character Federal School Code' }, 400)
  }

  const { data: institution, error: institutionError } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,address,city,state_code,zip_code,province,country,postal_code')
    .eq('school_code', schoolCode)
    .eq('active', true)
    .maybeSingle()

  if (institutionError) {
    console.error('Institution verification lookup failed:', institutionError.message || institutionError)
    return c.json({ error: 'Institution directory unavailable' }, 503)
  }
  if (!institution) return c.json({ error: 'School code not recognized' }, 404)

  const requestRow = {
    user_id: auth.user.id,
    school_code: schoolCode,
    status: 'pending',
    verification_method: 'school_code_plus_affiliation_review',
    requested_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    review_note: null
  }

  const { data, error } = await auth.supabase
    .from('instructor_verification_requests')
    .upsert(requestRow, { onConflict: 'user_id' })
    .select('id,school_code,status,verification_method,requested_at,reviewed_at')
    .single()

  if (error) {
    console.error('Instructor verification request failed:', error.message || error)
    return c.json({ error: 'Unable to create verification request' }, 500)
  }

  return c.json({
    verification: data,
    institution: publicInstitution(institution),
    authorizationGranted: false,
    message: 'Institution identified. Instructor affiliation review is pending.'
  }, 202)
}

export async function handleInstructorVerificationStatus(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  const { data, error } = await auth.supabase
    .from('instructor_verification_requests')
    .select('id,school_code,status,verification_method,requested_at,reviewed_at,review_note')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error) {
    console.error('Instructor verification status failed:', error.message || error)
    return c.json({ error: 'Unable to read verification status' }, 500)
  }

  if (!data) {
    return c.json({
      verification: null,
      institution: null,
      authorizationGranted: false
    }, 200)
  }

  const { data: institution } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,address,city,state_code,zip_code,province,country,postal_code')
    .eq('school_code', data.school_code)
    .maybeSingle()

  return c.json({
    verification: data,
    institution: publicInstitution(institution),
    authorizationGranted: data.status === 'approved'
  }, 200)
}

export { normalizeSchoolCode }

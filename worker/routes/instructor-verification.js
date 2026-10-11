import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import { isAdminRole, isInstructorRole, resolveTrustedRole } from '../auth/role-policy.js'

function normalizeSchoolCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function emailDomain(value) {
  const email = String(value || '').trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  return email.slice(at + 1)
}

async function verifiedInstitutionEmail(user, schoolCode, supabase) {
  const domain = emailDomain(user?.email)
  if (!domain) return { ok: false, domain: null }

  const { data, error } = await supabase
    .from('institution_email_domains')
    .select('school_code,domain,active')
    .eq('school_code', schoolCode)
    .eq('domain', domain)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    console.error('Institution email-domain lookup failed:', error.message || error)
    return { ok: false, domain, lookupError: true }
  }

  return { ok: Boolean(data), domain }
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

  const institutionEmail = await verifiedInstitutionEmail(
    auth.user,
    schoolCode,
    auth.supabase
  )
  if (institutionEmail.lookupError) {
    return c.json({ error: 'Institution email verification unavailable' }, 503)
  }
  if (!institutionEmail.ok) {
    return c.json({
      error: 'Use an approved institutional email address for this institution before requesting instructor access',
      institutionalEmailVerified: false
    }, 403)
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from('instructor_verification_requests')
    .select('id,school_code,status,verification_method,requested_at,reviewed_at')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (existingError) {
    console.error('Instructor verification request lookup failed:', existingError.message || existingError)
    return c.json({ error: 'Unable to read verification request' }, 500)
  }

  if (existing) {
    return c.json({
      error: 'A verification request already exists and cannot be replaced',
      verification: existing,
      authorizationGranted: false
    }, 409)
  }

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
    .insert(requestRow)
    .select('id,school_code,status,verification_method,requested_at,reviewed_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'A verification request already exists and cannot be replaced' }, 409)
    }
    console.error('Instructor verification request failed:', error.message || error)
    return c.json({ error: 'Unable to create verification request' }, 500)
  }

  return c.json({
    verification: data,
    institution: publicInstitution(institution),
    institutionalEmailVerified: true,
    authorizationGranted: false,
    message: 'Institution and institutional email verified. Instructor affiliation review is pending.'
  }, 202)
}

async function authorizeAdmin(c) {
  const auth = await authorize(c)
  if (auth.response) return auth

  const role = await resolveTrustedRole(auth.user, auth.supabase)
  if (!isAdminRole(role)) {
    return { response: c.json({ error: 'Admin access required' }, 403) }
  }

  return { ...auth, role }
}

function publicVerification(row, institution = null) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    schoolCode: row.school_code,
    status: row.status,
    verificationMethod: row.verification_method,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    institution: publicInstitution(institution)
  }
}

function validRequestId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

export async function handleAdminInstructorVerificationQueue(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAdmin(c)
  if (auth.response) return auth.response

  const status = String(c.req.query('status') || 'pending').trim().toLowerCase()
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return c.json({ error: 'status must be pending, approved, or rejected' }, 400)
  }

  const requestedLimit = Number.parseInt(c.req.query('limit') || '50', 10)
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 50

  const { data: requests, error } = await auth.supabase
    .from('instructor_verification_requests')
    .select('id,user_id,school_code,status,verification_method,requested_at,reviewed_at,reviewed_by,review_note')
    .eq('status', status)
    .order('requested_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Instructor verification admin queue failed:', error.message || error)
    return c.json({ error: 'Unable to read instructor verification queue' }, 500)
  }

  const schoolCodes = [...new Set((requests || []).map((row) => row.school_code).filter(Boolean))]
  let institutions = []
  if (schoolCodes.length) {
    const { data, error: institutionError } = await auth.supabase
      .from('institutions')
      .select('school_code,school_name,address,city,state_code,zip_code,province,country,postal_code')
      .in('school_code', schoolCodes)
    if (institutionError) {
      console.error('Instructor verification institution queue lookup failed:', institutionError.message || institutionError)
      return c.json({ error: 'Unable to read instructor verification queue' }, 500)
    }
    institutions = data || []
  }

  const institutionByCode = new Map(institutions.map((row) => [row.school_code, row]))
  return c.json({
    status,
    requests: (requests || []).map((row) => publicVerification(row, institutionByCode.get(row.school_code) || null))
  }, 200)
}

export async function handleAdminInstructorVerificationDecision(c) {
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAdmin(c)
  if (auth.response) return auth.response

  const requestId = String(c.req.param('requestId') || '').trim()
  if (!validRequestId(requestId)) {
    return c.json({ error: 'Valid verification request ID required' }, 400)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const decision = String(body?.decision || '').trim().toLowerCase()
  const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : ''
  if (!['approved', 'rejected'].includes(decision)) {
    return c.json({ error: 'decision must be approved or rejected' }, 400)
  }
  if (reviewNote.length > 1000) {
    return c.json({ error: 'reviewNote must be 1000 characters or fewer' }, 400)
  }
  if (decision === 'rejected' && !reviewNote) {
    return c.json({ error: 'reviewNote is required when rejecting a verification request' }, 400)
  }

  // Fail closed if the append-only audit migration has not been deployed.
  // This prevents an application-first deployment from finalizing a decision
  // without the database trigger that records immutable audit evidence.
  const { error: auditReadyError } = await auth.supabase
    .from('instructor_verification_decisions')
    .select('id')
    .limit(1)

  if (auditReadyError) {
    console.error('Instructor verification audit readiness check failed:', auditReadyError.message || auditReadyError)
    return c.json({ error: 'Instructor verification review audit unavailable' }, 503)
  }

  const { data: current, error: currentError } = await auth.supabase
    .from('instructor_verification_requests')
    .select('id,user_id,school_code,status,verification_method,requested_at,reviewed_at,reviewed_by,review_note')
    .eq('id', requestId)
    .maybeSingle()

  if (currentError) {
    console.error('Instructor verification admin lookup failed:', currentError.message || currentError)
    return c.json({ error: 'Unable to read instructor verification request' }, 500)
  }
  if (!current) return c.json({ error: 'Instructor verification request not found' }, 404)
  if (current.status !== 'pending') {
    return c.json({ error: 'Instructor verification decision is already final' }, 409)
  }

  const reviewedAt = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('instructor_verification_requests')
    .update({
      status: decision,
      reviewed_at: reviewedAt,
      reviewed_by: auth.user.id,
      review_note: reviewNote || null
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id,user_id,school_code,status,verification_method,requested_at,reviewed_at,reviewed_by,review_note')
    .maybeSingle()

  if (error) {
    console.error('Instructor verification admin decision failed:', error.message || error)
    return c.json({ error: 'Unable to save instructor verification decision' }, 500)
  }
  if (!data) {
    return c.json({ error: 'Instructor verification decision is already final' }, 409)
  }

  const { data: institution } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,address,city,state_code,zip_code,province,country,postal_code')
    .eq('school_code', data.school_code)
    .maybeSingle()

  return c.json({
    verification: publicVerification(data, institution),
    authorizationGranted: false,
    message: decision === 'approved'
      ? 'Instructor affiliation approved. A trusted instructor role is still required for privileged access.'
      : 'Instructor affiliation rejected.'
  }, 200)
}

export async function handleInstructorVerificationStatus(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  const role = await resolveTrustedRole(auth.user, auth.supabase)
  const isAdmin = isAdminRole(role)

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
      authorizationGranted: isAdmin,
      role
    }, 200)
  }

  const { data: institution } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,address,city,state_code,zip_code,province,country,postal_code')
    .eq('school_code', data.school_code)
    .maybeSingle()

  const institutionEmail = isAdmin
    ? { ok: true }
    : await verifiedInstitutionEmail(auth.user, data.school_code, auth.supabase)

  const authorizationGranted =
    isAdmin || (
      isInstructorRole(role) &&
      data.status === 'approved' &&
      institutionEmail.ok
    )

  return c.json({
    verification: data,
    institution: publicInstitution(institution),
    institutionalEmailVerified: Boolean(institutionEmail.ok),
    authorizationGranted,
    role
  }, 200)
}

export { normalizeSchoolCode }

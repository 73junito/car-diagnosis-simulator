import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'
import { isAdminRole, resolveTrustedRole } from '../auth/role-policy.js'

const REVIEW_ROLES = new Set(['institution_admin', 'institution_owner'])
const VALID_STATUSES = new Set(['claimed', 'verified', 'rejected'])

function createServiceClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

async function authorize(c) {
  const url = c.env?.SUPABASE_URL
  const key = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { response: c.json({ error: 'Server configuration incomplete' }, 500) }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Authentication required' }, 401) }

  const { user, error } = await verifySupabaseToken(token, url, key)
  if (error || !user?.id) return { response: c.json({ error: 'Authentication required' }, 401) }

  return { user, supabase: createServiceClient(url, key) }
}

function publicClaim(row, institution = null) {
  if (!row) return null
  return {
    userId: row.user_id,
    schoolCode: row.school_code,
    status: row.status,
    claimedAt: row.claimed_at,
    reviewedAt: row.verified_at,
    reviewedBy: row.verified_by,
    reviewNote: row.verification_note,
    institution: institution ? {
      schoolCode: institution.school_code,
      schoolName: institution.school_name,
      city: institution.city,
      stateCode: institution.state_code,
      country: institution.country
    } : null
  }
}

async function reviewerScope(auth) {
  const trustedRole = await resolveTrustedRole(auth.user, auth.supabase)
  if (isAdminRole(trustedRole)) return { platformAdmin: true, schoolCodes: null }

  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .select('school_code,role,status')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')

  if (error) return { error }

  const schoolCodes = (data || [])
    .filter((row) => REVIEW_ROLES.has(row.role))
    .map((row) => row.school_code)

  return { platformAdmin: false, schoolCodes }
}

export async function handleStudentInstitutionClaimStatus(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  const { data: claim, error } = await auth.supabase
    .from('student_institution_claims')
    .select('user_id,school_code,status,claimed_at,verified_at,verified_by,verification_note')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error) {
    console.error('Student institution claim status failed:', error.message || error)
    return c.json({ error: 'Unable to read institution claim status' }, 500)
  }
  if (!claim) return c.json({ claim: null }, 200)

  const { data: institution } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,city,state_code,country')
    .eq('school_code', claim.school_code)
    .maybeSingle()

  return c.json({ claim: publicClaim(claim, institution) }, 200)
}

export async function handleStudentInstitutionClaimQueue(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  const scope = await reviewerScope(auth)
  if (scope.error) {
    console.error('Student institution claim reviewer scope failed:', scope.error.message || scope.error)
    return c.json({ error: 'Unable to authorize claim review' }, 500)
  }
  if (!scope.platformAdmin && !scope.schoolCodes.length) {
    return c.json({ error: 'Institution reviewer access required' }, 403)
  }

  const status = String(c.req.query('status') || 'claimed').trim().toLowerCase()
  if (!VALID_STATUSES.has(status)) {
    return c.json({ error: 'status must be claimed, verified, or rejected' }, 400)
  }

  let query = auth.supabase
    .from('student_institution_claims')
    .select('user_id,school_code,status,claimed_at,verified_at,verified_by,verification_note')
    .eq('status', status)
    .order('claimed_at', { ascending: true })
    .limit(100)

  if (!scope.platformAdmin) query = query.in('school_code', scope.schoolCodes)

  const { data: claims, error } = await query
  if (error) {
    console.error('Student institution claim queue failed:', error.message || error)
    return c.json({ error: 'Unable to read institution claim queue' }, 500)
  }

  const schoolCodes = [...new Set((claims || []).map((row) => row.school_code))]
  let institutions = []
  if (schoolCodes.length) {
    const result = await auth.supabase
      .from('institutions')
      .select('school_code,school_name,city,state_code,country')
      .in('school_code', schoolCodes)
    if (result.error) return c.json({ error: 'Unable to read institution claim queue' }, 500)
    institutions = result.data || []
  }

  const byCode = new Map(institutions.map((row) => [row.school_code, row]))
  return c.json({
    status,
    claims: (claims || []).map((row) => publicClaim(row, byCode.get(row.school_code) || null))
  }, 200)
}

export async function handleStudentInstitutionClaimDecision(c) {
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorize(c)
  if (auth.response) return auth.response

  const userId = String(c.req.param('userId') || '').trim()
  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
    return c.json({ error: 'Valid student user ID required' }, 400)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const decision = String(body?.decision || '').trim().toLowerCase()
  const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.trim() : ''
  if (!['verified', 'rejected'].includes(decision)) {
    return c.json({ error: 'decision must be verified or rejected' }, 400)
  }
  if (reviewNote.length > 1000) {
    return c.json({ error: 'reviewNote must be 1000 characters or fewer' }, 400)
  }
  if (decision === 'rejected' && !reviewNote) {
    return c.json({ error: 'reviewNote is required when rejecting a claim' }, 400)
  }

  const scope = await reviewerScope(auth)
  if (scope.error) return c.json({ error: 'Unable to authorize claim review' }, 500)
  if (!scope.platformAdmin && !scope.schoolCodes.length) {
    return c.json({ error: 'Student institution claim not found' }, 404)
  }

  let lookup = auth.supabase
    .from('student_institution_claims')
    .select('user_id,school_code,status,claimed_at,verified_at,verified_by,verification_note')
    .eq('user_id', userId)

  if (!scope.platformAdmin) lookup = lookup.in('school_code', scope.schoolCodes)

  const { data: current, error: currentError } = await lookup.maybeSingle()
  if (currentError) {
    console.error('Student institution claim lookup failed:', currentError.message || currentError)
    return c.json({ error: 'Unable to read institution claim' }, 500)
  }
  if (!current) return c.json({ error: 'Student institution claim not found' }, 404)
  if (current.status !== 'claimed') {
    return c.json({ error: 'Student institution claim decision is already final' }, 409)
  }

  const reviewedAt = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('student_institution_claims')
    .update({
      status: decision,
      verified_at: reviewedAt,
      verified_by: auth.user.id,
      verification_note: reviewNote || null
    })
    .eq('user_id', current.user_id)
    .eq('school_code', current.school_code)
    .eq('status', 'claimed')
    .select('user_id,school_code,status,claimed_at,verified_at,verified_by,verification_note')
    .maybeSingle()

  if (error) {
    console.error('Student institution claim decision failed:', error.message || error)
    return c.json({ error: 'Unable to save institution claim decision' }, 500)
  }
  if (!data) return c.json({ error: 'Student institution claim decision is already final' }, 409)

  const { data: institution } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,city,state_code,country')
    .eq('school_code', data.school_code)
    .maybeSingle()

  return c.json({
    claim: publicClaim(data, institution),
    membershipEstablished: decision === 'verified',
    message: decision === 'verified'
      ? 'Student institution claim verified and institution member relationship established.'
      : 'Student institution claim rejected.'
  }, 200)
}

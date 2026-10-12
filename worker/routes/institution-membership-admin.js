import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import { isAdminRole, resolveTrustedRole } from '../auth/role-policy.js'

const ADMIN_ROLES = new Set(['institution_admin', 'institution_owner'])
const INVITABLE_ROLES = new Set(['member', 'instructor', 'institution_admin', 'institution_owner'])
const INVITATION_STATUSES = new Set(['pending', 'accepted', 'revoked', 'expired'])

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

async function authorizeAuthenticated(c) {
  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: c.json({ error: 'Server configuration incomplete' }, 500) }
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Authentication required' }, 401) }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user?.id) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  return {
    user,
    supabase: createServiceClient(supabaseUrl, serviceRoleKey)
  }
}

function normalizeSchoolCode(value) {
  const schoolCode = String(value || '').trim().toUpperCase()
  return /^[A-Z0-9]{6}$/.test(schoolCode) ? schoolCode : null
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!email || email.length > 320) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function publicInvitation(row) {
  return {
    id: row.id,
    schoolCode: row.school_code,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    note: row.note
  }
}

function publicMember(row, email = null) {
  return {
    id: row.id,
    schoolCode: row.school_code,
    userId: row.user_id,
    email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function loadActiveAdminMembership(auth, schoolCode) {
  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,user_id,role,status')
    .eq('school_code', schoolCode)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) return { error }
  if (!data || !ADMIN_ROLES.has(data.role)) return { forbidden: true }
  return { membership: data }
}

async function loadAuthorizedAdminMemberships(auth) {
  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,user_id,role,status')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')

  if (error) return { error }

  const memberships = (data || []).filter((row) => ADMIN_ROLES.has(row.role))
  return {
    memberships,
    bySchoolCode: new Map(memberships.map((row) => [row.school_code, row])),
    schoolCodes: memberships.map((row) => row.school_code)
  }
}

function canManageRole(actorRole, targetRole) {
  if (actorRole === 'institution_owner') return true
  return targetRole === 'member' || targetRole === 'instructor'
}

export async function handlePlatformAdminInstitutionOwnerInvitation(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const trustedRole = await resolveTrustedRole(auth.user, auth.supabase)
  if (!isAdminRole(trustedRole)) {
    return c.json({ error: 'Platform administrator access required' }, 403)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const schoolCode = normalizeSchoolCode(body?.schoolCode)
  const email = normalizeEmail(body?.email)
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)
  if (!email) return c.json({ error: 'Valid invitation email required' }, 400)
  if (note.length > 1000) return c.json({ error: 'note must be 1000 characters or fewer' }, 400)

  const { count: ownerCount, error: ownerError } = await auth.supabase
    .from('institution_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('school_code', schoolCode)
    .eq('status', 'active')
    .eq('role', 'institution_owner')

  if (ownerError) {
    console.error('Institution owner bootstrap lookup failed:', ownerError.message || ownerError)
    return c.json({ error: 'Unable to verify institution owner state' }, 500)
  }
  if (ownerCount) {
    return c.json({ error: 'Institution already has an active owner; use tenant membership administration' }, 409)
  }

  const { data: institution, error: institutionError } = await auth.supabase
    .from('institutions')
    .select('school_code')
    .eq('school_code', schoolCode)
    .eq('active', true)
    .maybeSingle()

  if (institutionError) {
    console.error('Institution owner bootstrap directory lookup failed:', institutionError.message || institutionError)
    return c.json({ error: 'Unable to verify institution' }, 500)
  }
  if (!institution) return c.json({ error: 'Active institution not found' }, 404)

  const { data, error } = await auth.supabase
    .from('institution_membership_invitations')
    .insert({
      school_code: schoolCode,
      email,
      role: 'institution_owner',
      status: 'pending',
      invited_by: auth.user.id,
      note: note || 'Initial institution owner invitation'
    })
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'A pending invitation already exists for this email and institution' }, 409)
    }
    console.error('Institution owner bootstrap invitation failed:', error.message || error)
    return c.json({ error: 'Unable to create institution owner invitation' }, 500)
  }

  return c.json({
    invitation: publicInvitation(data),
    message: 'Initial institution owner invitation created. No tenant access exists until the matching confirmed account accepts.'
  }, 201)
}

export async function handleInstitutionAdminMembers(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const schoolCode = normalizeSchoolCode(c.req.query('schoolCode'))
  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)

  const admin = await loadActiveAdminMembership(auth, schoolCode)
  if (admin.error) {
    console.error('Institution member admin authorization failed:', admin.error.message || admin.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (admin.forbidden) return c.json({ error: 'Institution administrator access required' }, 403)

  const { data: memberships, error } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,user_id,role,status,created_at,updated_at')
    .eq('school_code', schoolCode)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Institution member list failed:', error.message || error)
    return c.json({ error: 'Unable to load institution members' }, 500)
  }

  const rows = memberships || []
  const userIds = rows.map((row) => row.user_id)
  let profiles = []
  if (userIds.length) {
    const profileResult = await auth.supabase
      .from('profiles')
      .select('id,email')
      .in('id', userIds)
    if (profileResult.error) {
      console.error('Institution member profile lookup failed:', profileResult.error.message || profileResult.error)
      return c.json({ error: 'Unable to load institution members' }, 500)
    }
    profiles = profileResult.data || []
  }

  const emailById = new Map(profiles.map((profile) => [profile.id, profile.email || null]))
  return c.json({
    actorRole: admin.membership.role,
    members: rows.map((row) => publicMember(row, emailById.get(row.user_id) || null))
  }, 200)
}

export async function handleInstitutionAdminInvitations(c) {
  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  if (c.req.method === 'GET') {
    const schoolCode = normalizeSchoolCode(c.req.query('schoolCode'))
    const status = String(c.req.query('status') || 'pending').trim().toLowerCase()
    if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)
    if (!INVITATION_STATUSES.has(status)) {
      return c.json({ error: 'status must be pending, accepted, revoked, or expired' }, 400)
    }

    const admin = await loadActiveAdminMembership(auth, schoolCode)
    if (admin.error) {
      console.error('Institution invitation authorization failed:', admin.error.message || admin.error)
      return c.json({ error: 'Unable to authorize institution administration' }, 500)
    }
    if (admin.forbidden) return c.json({ error: 'Institution administrator access required' }, 403)

    const { data, error } = await auth.supabase
      .from('institution_membership_invitations')
      .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
      .eq('school_code', schoolCode)
      .eq('status', status)
      .order('invited_at', { ascending: false })

    if (error) {
      console.error('Institution invitation list failed:', error.message || error)
      return c.json({ error: 'Unable to load institution invitations' }, 500)
    }

    return c.json({ invitations: (data || []).map(publicInvitation) }, 200)
  }

  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const schoolCode = normalizeSchoolCode(body?.schoolCode)
  const email = normalizeEmail(body?.email)
  const role = String(body?.role || '').trim().toLowerCase()
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)
  if (!email) return c.json({ error: 'Valid invitation email required' }, 400)
  if (!INVITABLE_ROLES.has(role)) return c.json({ error: 'Valid institution role required' }, 400)
  if (note.length > 1000) return c.json({ error: 'note must be 1000 characters or fewer' }, 400)

  const admin = await loadActiveAdminMembership(auth, schoolCode)
  if (admin.error) {
    console.error('Institution invitation authorization failed:', admin.error.message || admin.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (admin.forbidden) return c.json({ error: 'Institution administrator access required' }, 403)
  if (!canManageRole(admin.membership.role, role)) {
    return c.json({ error: 'Only an institution owner may invite institution administrators or owners' }, 403)
  }

  const { data, error } = await auth.supabase
    .from('institution_membership_invitations')
    .insert({
      school_code: schoolCode,
      email,
      role,
      status: 'pending',
      invited_by: auth.user.id,
      note: note || null
    })
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'A pending invitation already exists for this email and institution' }, 409)
    }
    console.error('Institution invitation create failed:', error.message || error)
    return c.json({ error: 'Unable to create institution invitation' }, 500)
  }

  return c.json({
    invitation: publicInvitation(data),
    message: 'Invitation created. Institution access is not granted until the matching authenticated user accepts it.'
  }, 201)
}

export async function handleInstitutionAdminInvitationDecision(c) {
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const invitationId = String(c.req.param('invitationId') || '').trim()
  if (!/^[0-9a-fA-F-]{36}$/.test(invitationId)) {
    return c.json({ error: 'Valid invitation ID required' }, 400)
  }

  const authorized = await loadAuthorizedAdminMemberships(auth)
  if (authorized.error) {
    console.error('Institution invitation revoke authorization failed:', authorized.error.message || authorized.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (!authorized.schoolCodes.length) {
    return c.json({ error: 'Institution invitation not found' }, 404)
  }

  const { data: invitation, error: lookupError } = await auth.supabase
    .from('institution_membership_invitations')
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .eq('id', invitationId)
    .in('school_code', authorized.schoolCodes)
    .maybeSingle()

  if (lookupError) {
    console.error('Institution invitation lookup failed:', lookupError.message || lookupError)
    return c.json({ error: 'Unable to load institution invitation' }, 500)
  }
  if (!invitation) return c.json({ error: 'Institution invitation not found' }, 404)

  const admin = { membership: authorized.bySchoolCode.get(invitation.school_code) }

  if (!canManageRole(admin.membership.role, invitation.role)) {
    return c.json({ error: 'Only an institution owner may revoke administrator or owner invitations' }, 403)
  }
  if (invitation.status !== 'pending') {
    return c.json({ error: 'Only pending invitations may be revoked' }, 409)
  }

  const now = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('institution_membership_invitations')
    .update({
      status: 'revoked',
      revoked_by: auth.user.id,
      revoked_at: now
    })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .maybeSingle()

  if (error) {
    console.error('Institution invitation revoke failed:', error.message || error)
    return c.json({ error: 'Unable to revoke institution invitation' }, 500)
  }
  if (!data) return c.json({ error: 'Invitation is no longer pending' }, 409)

  return c.json({ invitation: publicInvitation(data) }, 200)
}

export async function handleInstitutionMyInvitations(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const userEmail = normalizeEmail(auth.user.email)
  if (!userEmail) return c.json({ invitations: [] }, 200)

  const now = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('institution_membership_invitations')
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .eq('email', userEmail)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('invited_at', { ascending: false })

  if (error) {
    console.error('Institution personal invitation list failed:', error.message || error)
    return c.json({ error: 'Unable to load institution invitations' }, 500)
  }

  const rows = data || []
  const schoolCodes = [...new Set(rows.map((row) => row.school_code))]
  let institutions = []
  if (schoolCodes.length) {
    const institutionResult = await auth.supabase
      .from('institutions')
      .select('school_code,school_name,city,state_code,province,country')
      .in('school_code', schoolCodes)
    if (institutionResult.error) {
      console.error('Institution invitation directory lookup failed:', institutionResult.error.message || institutionResult.error)
      return c.json({ error: 'Unable to load institution invitations' }, 500)
    }
    institutions = institutionResult.data || []
  }

  const institutionByCode = new Map(institutions.map((row) => [row.school_code, row]))
  return c.json({
    invitations: rows.map((row) => ({
      ...publicInvitation(row),
      institution: institutionByCode.get(row.school_code) || null
    }))
  }, 200)
}

export async function handleInstitutionInvitationAccept(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const invitationId = String(c.req.param('invitationId') || '').trim()
  if (!/^[0-9a-fA-F-]{36}$/.test(invitationId)) {
    return c.json({ error: 'Valid invitation ID required' }, 400)
  }

  const userEmail = normalizeEmail(auth.user.email)
  const emailConfirmed = Boolean(auth.user.email_confirmed_at || auth.user.confirmed_at)
  if (!userEmail || !emailConfirmed) {
    return c.json({ error: 'Confirmed account email required to accept institution invitation' }, 409)
  }

  const { data: invitation, error: lookupError } = await auth.supabase
    .from('institution_membership_invitations')
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .eq('id', invitationId)
    .eq('email', userEmail)
    .maybeSingle()

  if (lookupError) {
    console.error('Institution invitation accept lookup failed:', lookupError.message || lookupError)
    return c.json({ error: 'Unable to load institution invitation' }, 500)
  }
  if (!invitation) return c.json({ error: 'Institution invitation not found' }, 404)
  if (invitation.status !== 'pending') return c.json({ error: 'Invitation is no longer pending' }, 409)

  const now = new Date()
  if (new Date(invitation.expires_at) <= now) {
    await auth.supabase
      .from('institution_membership_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)
      .eq('status', 'pending')
    return c.json({ error: 'Institution invitation expired' }, 410)
  }

  const { data, error } = await auth.supabase
    .from('institution_membership_invitations')
    .update({
      status: 'accepted',
      accepted_by: auth.user.id,
      accepted_at: now.toISOString()
    })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .eq('email', userEmail)
    .select('id,school_code,email,role,status,invited_by,invited_at,expires_at,accepted_at,revoked_at,note')
    .maybeSingle()

  if (error) {
    if (error.code === 'P0001' || /institution_invitation_rejected/i.test(error.message || '')) {
      return c.json({ error: error.message || 'Invitation acceptance rejected' }, 409)
    }
    console.error('Institution invitation accept failed:', error.message || error)
    return c.json({ error: 'Unable to accept institution invitation' }, 500)
  }
  if (!data) return c.json({ error: 'Invitation is no longer pending' }, 409)

  return c.json({
    invitation: publicInvitation(data),
    message: 'Institution invitation accepted and active membership established.'
  }, 200)
}

export async function handleInstitutionAdminMemberDecision(c) {
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const membershipId = String(c.req.param('membershipId') || '').trim()
  if (!/^[0-9a-fA-F-]{36}$/.test(membershipId)) {
    return c.json({ error: 'Valid membership ID required' }, 400)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const action = String(body?.action || '').trim().toLowerCase()
  if (action !== 'suspend') return c.json({ error: 'action must be suspend' }, 400)

  const authorized = await loadAuthorizedAdminMemberships(auth)
  if (authorized.error) {
    console.error('Institution member removal authorization failed:', authorized.error.message || authorized.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (!authorized.schoolCodes.length) {
    return c.json({ error: 'Institution membership not found' }, 404)
  }

  const { data: target, error: targetError } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,user_id,role,status,created_at,updated_at')
    .eq('id', membershipId)
    .in('school_code', authorized.schoolCodes)
    .maybeSingle()

  if (targetError) {
    console.error('Institution member target lookup failed:', targetError.message || targetError)
    return c.json({ error: 'Unable to load institution membership' }, 500)
  }
  if (!target) return c.json({ error: 'Institution membership not found' }, 404)

  const admin = { membership: authorized.bySchoolCode.get(target.school_code) }

  if (!canManageRole(admin.membership.role, target.role)) {
    return c.json({ error: 'Only an institution owner may remove institution administrators or owners' }, 403)
  }
  if (target.status !== 'active') {
    return c.json({ error: 'Only active memberships may be removed' }, 409)
  }

  const now = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .update({ status: 'suspended', updated_by: auth.user.id, updated_at: now })
    .eq('id', target.id)
    .eq('status', 'active')
    .select('id,school_code,user_id,role,status,created_at,updated_at')
    .maybeSingle()

  if (error) {
    if (error.code === 'P0001' || /institution_membership_rejected/i.test(error.message || '')) {
      return c.json({ error: error.message || 'Membership removal rejected' }, 409)
    }
    console.error('Institution member removal failed:', error.message || error)
    return c.json({ error: 'Unable to remove institution membership' }, 500)
  }
  if (!data) return c.json({ error: 'Membership is no longer active' }, 409)


  return c.json({
    member: publicMember(data),
    message: 'Institution membership removed by suspension. Historical tenant records remain intact.'
  }, 200)
}

import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'
import {
  canonicalPrivilegedRole,
  isAdminRole,
  normalizeRole,
  resolveTrustedRole
} from '../auth/role-policy.js'

function createServiceClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

async function authorizePlatformAdmin(c) {
  const url = c.env?.SUPABASE_URL
  const key = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { response: c.json({ error: 'Server configuration incomplete' }, 500) }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Authentication required' }, 401) }

  const { user, error } = await verifySupabaseToken(token, url, key)
  if (error || !user?.id) return { response: c.json({ error: 'Authentication required' }, 401) }

  const supabase = createServiceClient(url, key)
  const role = await resolveTrustedRole(user, supabase)
  if (!isAdminRole(role)) return { response: c.json({ error: 'Platform admin access required' }, 403) }

  return { user, supabase, role }
}

function trustedRoleForUser(user, profileRole) {
  const metadataRole = canonicalPrivilegedRole(user?.app_metadata?.role)
  if (metadataRole) return { role: metadataRole, source: 'app_metadata' }

  const normalized = canonicalPrivilegedRole(profileRole) || normalizeRole(profileRole) || 'student'
  return { role: normalized, source: 'profile' }
}

function cleanLimit(value, fallback = 50, max = 100) {
  const parsed = Number.parseInt(value || String(fallback), 10)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(1, Math.min(parsed, max))
}

async function countRows(supabase, table, apply = (query) => query) {
  const result = await apply(
    supabase.from(table).select('*', { count: 'exact', head: true })
  )
  if (result.error) throw result.error
  return result.count || 0
}

export async function handlePlatformAdminOverview(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizePlatformAdmin(c)
  if (auth.response) return auth.response

  try {
    const [
      users,
      institutions,
      activeMemberships,
      pendingInstructor,
      pendingClaims,
      pendingDrafts,
      pendingPublications
    ] = await Promise.all([
      countRows(auth.supabase, 'profiles'),
      countRows(auth.supabase, 'institutions'),
      countRows(auth.supabase, 'institution_memberships', (q) => q.eq('status', 'active')),
      countRows(auth.supabase, 'instructor_verification_requests', (q) => q.eq('status', 'pending')),
      countRows(auth.supabase, 'student_institution_claims', (q) => q.eq('status', 'claimed')),
      countRows(auth.supabase, 'scenario_authoring_drafts', (q) => q.eq('review_status', 'pending')),
      countRows(auth.supabase, 'scenario_authoring_drafts', (q) => q.eq('publication_status', 'pending'))
    ])

    return c.json({
      users,
      institutions,
      activeMemberships,
      pending: {
        instructorVerification: pendingInstructor,
        studentInstitutionClaims: pendingClaims,
        authoringReview: pendingDrafts,
        publicationApproval: pendingPublications
      }
    }, 200)
  } catch (error) {
    console.error('Platform admin overview failed:', error?.message || error)
    return c.json({ error: 'Unable to load platform administration overview' }, 500)
  }
}

export async function handlePlatformAdminUsers(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizePlatformAdmin(c)
  if (auth.response) return auth.response

  const limit = cleanLimit(c.req.query('limit'), 50, 100)
  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10) || 1)

  const { data, error } = await auth.supabase.auth.admin.listUsers({ page, perPage: limit })
  if (error) {
    console.error('Platform admin user directory failed:', error.message || error)
    return c.json({ error: 'Unable to load user directory' }, 500)
  }

  const users = data?.users || []
  const ids = users.map((user) => user.id)
  let profiles = []
  if (ids.length) {
    const result = await auth.supabase
      .from('profiles')
      .select('id,email,role,created_at')
      .in('id', ids)
    if (result.error) return c.json({ error: 'Unable to load user directory' }, 500)
    profiles = result.data || []
  }

  const byId = new Map(profiles.map((row) => [row.id, row]))
  return c.json({
    page,
    limit,
    users: users.map((user) => {
      const profile = byId.get(user.id)
      const trusted = trustedRoleForUser(user, profile?.role)
      return {
        id: user.id,
        email: user.email || profile?.email || null,
        role: trusted.role,
        roleSource: trusted.source,
        profileRole: profile?.role || null,
        createdAt: user.created_at || profile?.created_at || null,
        lastSignInAt: user.last_sign_in_at || null,
        emailConfirmedAt: user.email_confirmed_at || user.confirmed_at || null
      }
    })
  }, 200)
}

export async function handlePlatformAdminInstitutions(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizePlatformAdmin(c)
  if (auth.response) return auth.response

  const q = String(c.req.query('q') || '').trim()
  const limit = cleanLimit(c.req.query('limit'), 50, 100)

  let query = auth.supabase
    .from('institutions')
    .select('school_code,school_name,city,state_code,country,active')
    .order('school_name', { ascending: true })
    .limit(limit)

  if (q) {
    if (/^[A-Za-z0-9]{6}$/.test(q)) query = query.eq('school_code', q.toUpperCase())
    else query = query.ilike('school_name', '%' + q.slice(0, 120) + '%')
  }

  const { data: institutions, error } = await query
  if (error) return c.json({ error: 'Unable to load institution directory' }, 500)

  const schoolCodes = (institutions || []).map((row) => row.school_code)
  let memberships = []
  let domains = []
  if (schoolCodes.length) {
    const [membershipResult, domainResult] = await Promise.all([
      auth.supabase
        .from('institution_memberships')
        .select('school_code,role,status')
        .in('school_code', schoolCodes),
      auth.supabase
        .from('institution_email_domains')
        .select('school_code,active')
        .in('school_code', schoolCodes)
    ])
    if (membershipResult.error || domainResult.error) {
      return c.json({ error: 'Unable to load institution directory' }, 500)
    }
    memberships = membershipResult.data || []
    domains = domainResult.data || []
  }

  const stats = new Map()
  for (const schoolCode of schoolCodes) {
    stats.set(schoolCode, {
      activeMemberships: 0,
      owners: 0,
      admins: 0,
      activeDomains: 0
    })
  }

  memberships.forEach((row) => {
    if (row.status !== 'active') return
    const stat = stats.get(row.school_code)
    if (!stat) return
    stat.activeMemberships += 1
    if (row.role === 'institution_owner') stat.owners += 1
    if (row.role === 'institution_admin') stat.admins += 1
  })

  domains.forEach((row) => {
    if (!row.active) return
    const stat = stats.get(row.school_code)
    if (stat) stat.activeDomains += 1
  })

  return c.json({
    institutions: (institutions || []).map((row) => ({
      schoolCode: row.school_code,
      schoolName: row.school_name,
      city: row.city,
      stateCode: row.state_code,
      country: row.country,
      active: row.active,
      ...(stats.get(row.school_code) || {})
    }))
  }, 200)
}

function normalizeAudit(type, row, detail = {}) {
  return {
    type,
    id: row.id,
    actorId: row.actor_id || row.reviewed_by || null,
    schoolCode: row.school_code || detail.schoolCode || null,
    action: detail.action || row.action || row.decision || row.to_status || null,
    subjectId: detail.subjectId || row.subject_user_id || row.user_id || row.draft_id || null,
    createdAt: row.created_at || row.reviewed_at || null,
    note: detail.note ?? row.note ?? row.review_note ?? null
  }
}

export async function handlePlatformAdminAudit(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizePlatformAdmin(c)
  if (auth.response) return auth.response

  const limit = cleanLimit(c.req.query('limit'), 50, 100)
  const perSource = Math.max(10, Math.ceil(limit / 2))

  const results = await Promise.all([
    auth.supabase.from('instructor_verification_decisions')
      .select('id,user_id,school_code,decision,reviewed_by,reviewed_at,review_note,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('student_institution_claim_events')
      .select('id,user_id,school_code,actor_id,action,review_note,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('institution_membership_events')
      .select('id,school_code,actor_id,subject_user_id,action,role,note,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('institution_domain_events')
      .select('id,school_code,domain,actor_id,action,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('institution_settings_events')
      .select('id,school_code,actor_id,action,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('scenario_authoring_draft_review_events')
      .select('id,draft_id,from_status,to_status,actor_id,note,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('scenario_authoring_publication_events')
      .select('id,draft_id,from_status,to_status,actor_id,note,created_at')
      .order('created_at', { ascending: false }).limit(perSource),
    auth.supabase.from('platform_operational_setting_events')
      .select('id,setting_key,actor_id,created_at')
      .order('created_at', { ascending: false }).limit(perSource)
  ])

  const firstError = results.find((result) => result.error)?.error
  if (firstError) {
    console.error('Platform admin audit feed failed:', firstError.message || firstError)
    return c.json({ error: 'Unable to load audit history' }, 500)
  }

  const [
    instructor,
    student,
    membership,
    domain,
    settings,
    draftReview,
    publication,
    operations
  ] = results.map((result) => result.data || [])

  const events = [
    ...instructor.map((row) => normalizeAudit('instructor_verification', row)),
    ...student.map((row) => normalizeAudit('student_institution_claim', row)),
    ...membership.map((row) => normalizeAudit('institution_membership', row, {
      action: row.role ? row.action + ':' + row.role : row.action
    })),
    ...domain.map((row) => normalizeAudit('institution_domain', row, {
      subjectId: row.domain
    })),
    ...settings.map((row) => normalizeAudit('institution_settings', row)),
    ...draftReview.map((row) => normalizeAudit('authoring_review', row, {
      action: row.from_status + '→' + row.to_status
    })),
    ...publication.map((row) => normalizeAudit('authoring_publication', row, {
      action: row.from_status + '→' + row.to_status
    })),
    ...operations.map((row) => normalizeAudit('platform_operations', row, {
      action: 'operational_settings_updated',
      subjectId: row.setting_key
    }))
  ]
    .filter((row) => row.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)

  return c.json({ events }, 200)
}

export async function handlePlatformAdminOperationalSettings(c) {
  if (!['GET', 'PATCH'].includes(c.req.method)) {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authorizePlatformAdmin(c)
  if (auth.response) return auth.response

  const { data: current, error: readError } = await auth.supabase
    .from('platform_operational_settings')
    .select('setting_key,owner_bootstrap_enabled,operations_note,updated_by,updated_at')
    .eq('setting_key', 'global')
    .maybeSingle()

  if (readError || !current) {
    return c.json({ error: 'Operational configuration unavailable' }, 503)
  }

  if (c.req.method === 'GET') {
    return c.json({
      settings: {
        ownerBootstrapEnabled: current.owner_bootstrap_enabled,
        operationsNote: current.operations_note,
        updatedBy: current.updated_by,
        updatedAt: current.updated_at
      }
    }, 200)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const hasOwnerBootstrap = typeof body?.ownerBootstrapEnabled === 'boolean'
  const hasOperationsNote = Object.prototype.hasOwnProperty.call(body || {}, 'operationsNote')
  if (!hasOwnerBootstrap && !hasOperationsNote) {
    return c.json({ error: 'No operational setting change supplied' }, 400)
  }

  const nextOwnerBootstrap = hasOwnerBootstrap
    ? body.ownerBootstrapEnabled
    : current.owner_bootstrap_enabled

  if (
    hasOwnerBootstrap &&
    nextOwnerBootstrap !== current.owner_bootstrap_enabled &&
    body?.confirmed !== true
  ) {
    return c.json({ error: 'Explicit confirmation is required to change owner bootstrap availability' }, 400)
  }

  let operationsNote = current.operations_note
  if (hasOperationsNote) {
    operationsNote = body.operationsNote == null ? null : String(body.operationsNote).trim() || null
    if (operationsNote && operationsNote.length > 2000) {
      return c.json({ error: 'operationsNote must be 2000 characters or fewer' }, 400)
    }
  }

  const { data, error } = await auth.supabase
    .from('platform_operational_settings')
    .update({
      owner_bootstrap_enabled: nextOwnerBootstrap,
      operations_note: operationsNote,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString()
    })
    .eq('setting_key', 'global')
    .select('setting_key,owner_bootstrap_enabled,operations_note,updated_by,updated_at')
    .single()

  if (error) {
    console.error('Platform operational settings update failed:', error.message || error)
    return c.json({ error: 'Unable to save operational configuration' }, 500)
  }

  return c.json({
    settings: {
      ownerBootstrapEnabled: data.owner_bootstrap_enabled,
      operationsNote: data.operations_note,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at
    },
    message: 'Operational configuration saved and audit evidence recorded.'
  }, 200)
}

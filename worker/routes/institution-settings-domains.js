import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'

const ADMIN_ROLES = new Set(['institution_admin', 'institution_owner'])
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

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

function normalizeDomain(value) {
  const domain = String(value || '').trim().toLowerCase()
  return DOMAIN_RE.test(domain) ? domain : null
}

function normalizeNullableText(value, maxLength) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  if (text.length > maxLength) return undefined
  return text
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

function publicSettings(row) {
  if (!row) {
    return {
      displayName: null,
      websiteUrl: null,
      supportEmail: null,
      timezone: null,
      locale: 'en-US'
    }
  }
  return {
    schoolCode: row.school_code,
    displayName: row.display_name,
    websiteUrl: row.website_url,
    supportEmail: row.support_email,
    timezone: row.timezone,
    locale: row.locale,
    updatedAt: row.updated_at
  }
}

function publicDomain(row) {
  return {
    schoolCode: row.school_code,
    domain: row.domain,
    active: row.active,
    sourceReference: row.source_reference,
    verifiedAt: row.verified_at,
    updatedAt: row.updated_at,
    deactivatedAt: row.deactivated_at
  }
}

export async function handleInstitutionAdminSettings(c) {
  if (!['GET', 'PATCH'].includes(c.req.method)) return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  let body = null
  if (c.req.method === 'PATCH') {
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
  }

  const schoolCode = normalizeSchoolCode(
    c.req.method === 'GET' ? c.req.query('schoolCode') : body?.schoolCode
  )
  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)

  const admin = await loadActiveAdminMembership(auth, schoolCode)
  if (admin.error) {
    console.error('Institution settings authorization failed:', admin.error.message || admin.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (admin.forbidden) return c.json({ error: 'Institution administrator access required' }, 403)

  if (c.req.method === 'GET') {
    const { data, error } = await auth.supabase
      .from('institution_settings')
      .select('school_code,display_name,website_url,support_email,timezone,locale,updated_at')
      .eq('school_code', schoolCode)
      .maybeSingle()

    if (error) {
      console.error('Institution settings lookup failed:', error.message || error)
      return c.json({ error: 'Unable to load institution settings' }, 500)
    }

    return c.json({
      actorRole: admin.membership.role,
      settings: publicSettings(data)
    }, 200)
  }

  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const displayName = normalizeNullableText(body?.displayName, 160)
  const websiteUrl = normalizeNullableText(body?.websiteUrl, 500)
  const supportEmail = normalizeNullableText(body?.supportEmail, 320)
  const timezone = normalizeNullableText(body?.timezone, 100)
  const localeValue = normalizeNullableText(body?.locale, 35)

  if ([displayName, websiteUrl, supportEmail, timezone, localeValue].some((value) => value === undefined)) {
    return c.json({ error: 'Institution setting exceeds allowed length' }, 400)
  }
  if (websiteUrl && !/^https:\/\/[^\s]+$/.test(websiteUrl)) {
    return c.json({ error: 'websiteUrl must use https://' }, 400)
  }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    return c.json({ error: 'Valid supportEmail required' }, 400)
  }

  const now = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('institution_settings')
    .upsert({
      school_code: schoolCode,
      display_name: displayName,
      website_url: websiteUrl,
      support_email: supportEmail ? supportEmail.toLowerCase() : null,
      timezone,
      locale: localeValue || 'en-US',
      updated_by: auth.user.id,
      updated_at: now
    }, { onConflict: 'school_code' })
    .select('school_code,display_name,website_url,support_email,timezone,locale,updated_at')
    .single()

  if (error) {
    console.error('Institution settings update failed:', error.message || error)
    return c.json({ error: 'Unable to save institution settings' }, 500)
  }

  return c.json({
    settings: publicSettings(data),
    message: 'Institution settings saved and audit evidence recorded.'
  }, 200)
}

export async function handleInstitutionAdminDomains(c) {
  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  if (c.req.method === 'GET') {
    const schoolCode = normalizeSchoolCode(c.req.query('schoolCode'))
    if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)

    const admin = await loadActiveAdminMembership(auth, schoolCode)
    if (admin.error) {
      console.error('Institution domain authorization failed:', admin.error.message || admin.error)
      return c.json({ error: 'Unable to authorize institution administration' }, 500)
    }
    if (admin.forbidden) return c.json({ error: 'Institution administrator access required' }, 403)

    const { data, error } = await auth.supabase
      .from('institution_email_domains')
      .select('school_code,domain,active,source_reference,verified_at,updated_at,deactivated_at')
      .eq('school_code', schoolCode)
      .order('domain', { ascending: true })

    if (error) {
      console.error('Institution domain list failed:', error.message || error)
      return c.json({ error: 'Unable to load verified domains' }, 500)
    }

    return c.json({
      actorRole: admin.membership.role,
      domains: (data || []).map(publicDomain),
      accessBoundary: 'Verified domains are affiliation evidence only; active membership remains required for tenant access.'
    }, 200)
  }

  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const schoolCode = normalizeSchoolCode(body?.schoolCode)
  const domain = normalizeDomain(body?.domain)
  const sourceReference = normalizeNullableText(body?.sourceReference, 1000)
  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)
  if (!domain) return c.json({ error: 'Valid institutional domain required' }, 400)
  if (!sourceReference || sourceReference === undefined) {
    return c.json({ error: 'sourceReference is required and must be 1000 characters or fewer' }, 400)
  }

  const admin = await loadActiveAdminMembership(auth, schoolCode)
  if (admin.error) {
    console.error('Institution domain create authorization failed:', admin.error.message || admin.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (admin.forbidden || admin.membership.role !== 'institution_owner') {
    return c.json({ error: 'Institution owner access required for verified-domain changes' }, 403)
  }

  const now = new Date().toISOString()
  const { data, error } = await auth.supabase
    .from('institution_email_domains')
    .insert({
      school_code: schoolCode,
      domain,
      active: true,
      source_reference: sourceReference,
      verified_by: auth.user.id,
      verified_at: now,
      updated_by: auth.user.id,
      updated_at: now,
      deactivated_by: null,
      deactivated_at: null
    })
    .select('school_code,domain,active,source_reference,verified_at,updated_at,deactivated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'Verified domain already exists for this institution; update the existing row instead' }, 409)
    }
    console.error('Institution domain create failed:', error.message || error)
    return c.json({ error: 'Unable to add verified domain' }, 500)
  }

  return c.json({
    domain: publicDomain(data),
    message: 'Verified domain added as affiliation evidence only. No tenant access was granted.'
  }, 201)
}

export async function handleInstitutionAdminDomainDecision(c) {
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const schoolCode = normalizeSchoolCode(c.req.query('schoolCode'))
  const domain = normalizeDomain(c.req.param('domain'))
  if (!schoolCode) return c.json({ error: 'Valid institution schoolCode required' }, 400)
  if (!domain) return c.json({ error: 'Valid institutional domain required' }, 400)

  const admin = await loadActiveAdminMembership(auth, schoolCode)
  if (admin.error) {
    console.error('Institution domain update authorization failed:', admin.error.message || admin.error)
    return c.json({ error: 'Unable to authorize institution administration' }, 500)
  }
  if (admin.forbidden || admin.membership.role !== 'institution_owner') {
    return c.json({ error: 'Institution owner access required for verified-domain changes' }, 403)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const hasActive = typeof body?.active === 'boolean'
  const hasSource = Object.prototype.hasOwnProperty.call(body || {}, 'sourceReference')
  if (!hasActive && !hasSource) {
    return c.json({ error: 'active or sourceReference change required' }, 400)
  }

  const sourceReference = hasSource ? normalizeNullableText(body.sourceReference, 1000) : null
  if (hasSource && (!sourceReference || sourceReference === undefined)) {
    return c.json({ error: 'sourceReference is required and must be 1000 characters or fewer' }, 400)
  }

  const { data: current, error: currentError } = await auth.supabase
    .from('institution_email_domains')
    .select('school_code,domain,active,source_reference,verified_at,updated_at,deactivated_at')
    .eq('school_code', schoolCode)
    .eq('domain', domain)
    .maybeSingle()

  if (currentError) {
    console.error('Institution domain target lookup failed:', currentError.message || currentError)
    return c.json({ error: 'Unable to load verified domain' }, 500)
  }
  if (!current) return c.json({ error: 'Verified domain not found' }, 404)

  const now = new Date().toISOString()
  const updates = {
    updated_by: auth.user.id,
    updated_at: now
  }

  if (hasSource) {
    updates.source_reference = sourceReference
    updates.verified_by = auth.user.id
    updates.verified_at = now
  }

  if (hasActive) {
    updates.active = body.active
    updates.verified_by = auth.user.id
    updates.verified_at = now
    updates.deactivated_by = body.active ? null : auth.user.id
    updates.deactivated_at = body.active ? null : now
  }

  const { data, error } = await auth.supabase
    .from('institution_email_domains')
    .update(updates)
    .eq('school_code', schoolCode)
    .eq('domain', domain)
    .select('school_code,domain,active,source_reference,verified_at,updated_at,deactivated_at')
    .maybeSingle()

  if (error) {
    console.error('Institution domain update failed:', error.message || error)
    return c.json({ error: 'Unable to update verified domain' }, 500)
  }
  if (!data) return c.json({ error: 'Verified domain changed or no longer exists' }, 409)

  return c.json({
    domain: publicDomain(data),
    message: 'Verified-domain state updated. This does not create membership, roles, or assessment eligibility.'
  }, 200)
}

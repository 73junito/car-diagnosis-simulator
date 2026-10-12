import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import {
  isAdminRole,
  isInstructorRole,
  resolveTrustedRole
} from '../auth/role-policy.js'

const MAX_PAYLOAD_BYTES = 100 * 1024

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

function emailDomain(value) {
  const email = String(value || '').trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  return email.slice(at + 1)
}

async function authorizeAuthor(c) {
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

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const role = await resolveTrustedRole(user, supabase)
  if (isAdminRole(role)) return { user, supabase, role }

  if (!isInstructorRole(role)) {
    return { response: c.json({ error: 'Verified instructor access required' }, 403) }
  }

  const { data: verification, error: verificationError } = await supabase
    .from('instructor_verification_requests')
    .select('school_code,status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (verificationError) {
    console.error('Author verification lookup failed:', verificationError.message || verificationError)
    return { response: c.json({ error: 'Author verification unavailable' }, 503) }
  }

  if (!verification || verification.status !== 'approved') {
    return { response: c.json({ error: 'Verified instructor access required' }, 403) }
  }

  const domain = emailDomain(user.email)
  if (!domain) {
    return { response: c.json({ error: 'Verified instructor access required' }, 403) }
  }

  const { data: approvedDomain, error: domainError } = await supabase
    .from('institution_email_domains')
    .select('school_code')
    .eq('school_code', verification.school_code)
    .eq('domain', domain)
    .eq('active', true)
    .maybeSingle()

  if (domainError) {
    console.error('Author institutional-email lookup failed:', domainError.message || domainError)
    return { response: c.json({ error: 'Author verification unavailable' }, 503) }
  }

  if (!approvedDomain) {
    return { response: c.json({ error: 'Verified instructor access required' }, 403) }
  }

  return { user, supabase, role }
}

function validDraftId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function normalizeScenario(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'scenario must be an object' }
  }

  let serialized
  try {
    serialized = JSON.stringify(value)
  } catch {
    return { error: 'scenario must be JSON serializable' }
  }

  if (new TextEncoder().encode(serialized).length > MAX_PAYLOAD_BYTES) {
    return { error: 'scenario payload must be 100 KiB or smaller' }
  }

  const scenarioKey = String(value.id || '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(scenarioKey)) {
    return { error: 'scenario.id must be a lowercase slug up to 80 characters' }
  }

  const title = String(value.title || '').trim()
  if (!title || title.length > 200) {
    return { error: 'scenario.title is required and must be 200 characters or fewer' }
  }

  return {
    scenarioKey,
    title,
    payload: value
  }
}

function publicDraft(row, includePayload = false) {
  const draft = {
    id: row.id,
    scenarioKey: row.scenario_key,
    title: row.title,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
  if (includePayload) draft.scenario = row.payload_json
  return draft
}

export async function handleAuthorDrafts(c) {
  const auth = await authorizeAuthor(c)
  if (auth.response) return auth.response

  if (c.req.method === 'GET') {
    const requestedLimit = Number.parseInt(c.req.query('limit') || '50', 10)
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 50

    const { data, error } = await auth.supabase
      .from('scenario_authoring_drafts')
      .select('id,scenario_key,title,version,status,created_at,updated_at')
      .eq('owner_id', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Author draft list failed:', error.message || error)
      return c.json({ error: 'Unable to read author drafts' }, 500)
    }

    return c.json({ drafts: (data || []).map((row) => publicDraft(row)) }, 200)
  }

  if (c.req.method === 'POST') {
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const normalized = normalizeScenario(body?.scenario)
    if (normalized.error) return c.json({ error: normalized.error }, 400)

    const now = new Date().toISOString()
    const { data, error } = await auth.supabase
      .from('scenario_authoring_drafts')
      .insert({
        owner_id: auth.user.id,
        scenario_key: normalized.scenarioKey,
        title: normalized.title,
        payload_json: normalized.payload,
        version: 1,
        status: 'draft',
        created_at: now,
        updated_at: now
      })
      .select('id,scenario_key,title,version,status,created_at,updated_at,payload_json')
      .single()

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A draft with this scenario ID already exists' }, 409)
      }
      console.error('Author draft create failed:', error.message || error)
      return c.json({ error: 'Unable to create author draft' }, 500)
    }

    return c.json({ draft: publicDraft(data, true) }, 201)
  }

  return c.json({ error: 'Method not allowed' }, 405)
}

export async function handleAuthorDraft(c) {
  const auth = await authorizeAuthor(c)
  if (auth.response) return auth.response

  const draftId = String(c.req.param('draftId') || '').trim()
  if (!validDraftId(draftId)) return c.json({ error: 'Valid draft ID required' }, 400)

  if (c.req.method === 'GET') {
    const { data, error } = await auth.supabase
      .from('scenario_authoring_drafts')
      .select('id,scenario_key,title,version,status,created_at,updated_at,payload_json')
      .eq('id', draftId)
      .eq('owner_id', auth.user.id)
      .maybeSingle()

    if (error) {
      console.error('Author draft read failed:', error.message || error)
      return c.json({ error: 'Unable to read author draft' }, 500)
    }
    if (!data) return c.json({ error: 'Author draft not found' }, 404)

    return c.json({ draft: publicDraft(data, true) }, 200)
  }

  if (c.req.method === 'PATCH') {
    let body
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const version = Number.parseInt(body?.version, 10)
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ error: 'Current draft version required' }, 400)
    }

    const normalized = normalizeScenario(body?.scenario)
    if (normalized.error) return c.json({ error: normalized.error }, 400)

    const { data, error } = await auth.supabase
      .from('scenario_authoring_drafts')
      .update({
        scenario_key: normalized.scenarioKey,
        title: normalized.title,
        payload_json: normalized.payload,
        version: version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId)
      .eq('owner_id', auth.user.id)
      .eq('status', 'draft')
      .eq('version', version)
      .select('id,scenario_key,title,version,status,created_at,updated_at,payload_json')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'A draft with this scenario ID already exists' }, 409)
      }
      console.error('Author draft update failed:', error.message || error)
      return c.json({ error: 'Unable to save author draft' }, 500)
    }
    if (!data) {
      return c.json({ error: 'Draft changed since it was loaded; reload before saving' }, 409)
    }

    return c.json({ draft: publicDraft(data, true) }, 200)
  }

  if (c.req.method === 'DELETE') {
    const { data, error } = await auth.supabase
      .from('scenario_authoring_drafts')
      .delete()
      .eq('id', draftId)
      .eq('owner_id', auth.user.id)
      .eq('status', 'draft')
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Author draft delete failed:', error.message || error)
      return c.json({ error: 'Unable to delete author draft' }, 500)
    }
    if (!data) return c.json({ error: 'Author draft not found' }, 404)

    return c.json({ deleted: true, id: data.id }, 200)
  }

  return c.json({ error: 'Method not allowed' }, 405)
}

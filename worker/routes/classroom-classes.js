import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import { isInstructorRole, resolveTrustedRole } from '../auth/role-policy.js'

const CLASS_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CLASS_CODE_LENGTH = 6
const MAX_CLASS_NAME_LENGTH = 120
const MAX_CLASS_CODE_ATTEMPTS = 5

function createServiceClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

function normalizeClassName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (!name || name.length > MAX_CLASS_NAME_LENGTH) return null
  return name
}

function makeClassCode() {
  const values = new Uint32Array(CLASS_CODE_LENGTH)
  globalThis.crypto.getRandomValues(values)
  let code = ''
  for (const value of values) {
    code += CLASS_CODE_ALPHABET[value % CLASS_CODE_ALPHABET.length]
  }
  return code
}

async function authorizeInstructor(c) {
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

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
  const role = await resolveTrustedRole(user, supabase)
  if (!isInstructorRole(role)) {
    return { response: c.json({ error: 'Instructor access required' }, 403) }
  }

  return { user, role, supabase }
}

function publicClass(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    owner_id: row.owner_id,
    class_code: row.class_code,
    created_at: row.created_at
  }
}

export async function handleListClasses(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const { data, error } = await auth.supabase
    .from('classes')
    .select('id,name,owner_id,class_code,created_at')
    .eq('owner_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Class list failed:', error.message || error)
    return c.json({ error: 'Unable to load classes' }, 500)
  }

  return c.json({ classes: (data || []).map(publicClass) }, 200)
}

export async function handleCreateClass(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const name = normalizeClassName(body?.name)
  if (!name) {
    return c.json({ error: 'name is required and must be 120 characters or fewer' }, 400)
  }

  for (let attempt = 0; attempt < MAX_CLASS_CODE_ATTEMPTS; attempt += 1) {
    const payload = {
      name,
      owner_id: auth.user.id,
      class_code: makeClassCode()
    }

    const { data, error } = await auth.supabase
      .from('classes')
      .insert(payload)
      .select('id,name,owner_id,class_code,created_at')
      .single()

    if (!error) {
      return c.json({ success: true, class: publicClass(data) }, 201)
    }

    if (error.code === '23505' && attempt < MAX_CLASS_CODE_ATTEMPTS - 1) {
      continue
    }

    console.error('Class create failed:', error.message || error)
    return c.json({ error: 'Unable to create class' }, error.code === '23505' ? 409 : 500)
  }

  return c.json({ error: 'Unable to create class' }, 409)
}

export {
  MAX_CLASS_NAME_LENGTH,
  normalizeClassName,
  makeClassCode
}

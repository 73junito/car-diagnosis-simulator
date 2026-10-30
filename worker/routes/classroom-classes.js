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

function normalizeClassCode(value) {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  if (!new RegExp(`^[A-Z0-9]{${CLASS_CODE_LENGTH}}$`).test(code)) return null
  return code
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

async function authorizeAuthenticated(c) {
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

async function authorizeInstructor(c) {
  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth

  const role = await resolveTrustedRole(auth.user, auth.supabase)
  if (!isInstructorRole(role)) {
    return { response: c.json({ error: 'Instructor access required' }, 403) }
  }

  return { ...auth, role }
}

function publicClass(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    owner_id: row.owner_id,
    class_code: row.class_code,
    institution_school_code: row.institution_school_code || null,
    institution_program_id: row.institution_program_id || null,
    institution_cohort_id: row.institution_cohort_id || null,
    created_at: row.created_at
  }
}

async function resolveInstructorInstitution(auth, requestedSchoolCode = null) {
  let query = auth.supabase
    .from('institution_memberships')
    .select('school_code,role,status')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .in('role', ['instructor', 'institution_admin', 'institution_owner'])

  if (requestedSchoolCode) query = query.eq('school_code', requestedSchoolCode)

  const { data, error } = await query.order('school_code', { ascending: true })
  if (error) return { error }

  const memberships = data || []
  if (requestedSchoolCode) {
    return memberships.length === 1
      ? { schoolCode: memberships[0].school_code }
      : { forbidden: true }
  }

  if (memberships.length === 1) return { schoolCode: memberships[0].school_code }
  if (memberships.length === 0) return { schoolCode: null }
  return { selectionRequired: true }
}

async function resolveEnrollmentEligibility(auth, cls) {
  // R26 Phase 2 / R2: a class code identifies a class, it never establishes eligibility.
  // Institution-scoped classes require an ACTIVE membership in the class's own institution,
  // resolved from the server-verified identity only (never a client-supplied user id or
  // school code). This is a minimum eligibility requirement, not evidence that the student
  // was individually invited or approved for this class.
  if (!cls?.institution_school_code) {
    // Unscoped classes have no eligibility mechanism yet; refuse rather than inherit the
    // open class-code model. Pending the F4 product decision.
    return { allowed: false, reason: 'unscoped_enrollment_not_permitted' }
  }

  const { data, error } = await auth.supabase
    .from('institution_memberships')
    .select('school_code,role,status')
    .eq('user_id', auth.user.id)
    .eq('school_code', cls.institution_school_code)
    .eq('status', 'active')
    .maybeSingle()

  // Fail closed: an unverifiable membership is never treated as membership.
  if (error) return { allowed: false, status: 503, reason: 'eligibility_lookup_failed' }
  if (!data) return { allowed: false, reason: 'no_active_institution_membership' }

  return { allowed: true, schoolCode: data.school_code }
}

function joinableClass(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name
  }
}

export async function handleListClasses(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const { data, error } = await auth.supabase
    .from('classes')
    .select('id,name,owner_id,class_code,institution_school_code,institution_program_id,institution_cohort_id,created_at')
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

  const requestedSchoolCode = typeof body?.schoolCode === 'string'
    ? body.schoolCode.trim().toUpperCase()
    : null
  if (requestedSchoolCode && !/^[A-Z0-9]{6}$/.test(requestedSchoolCode)) {
    return c.json({ error: 'Valid schoolCode required' }, 400)
  }

  const institution = await resolveInstructorInstitution(auth, requestedSchoolCode)
  if (institution.error) {
    console.error('Class institution membership lookup failed:', institution.error.message || institution.error)
    return c.json({ error: 'Unable to verify institution membership' }, 500)
  }
  if (institution.forbidden) {
    return c.json({ error: 'Active instructor institution membership required' }, 403)
  }
  if (institution.selectionRequired) {
    return c.json({ error: 'schoolCode is required when the instructor belongs to multiple institutions' }, 400)
  }

  for (let attempt = 0; attempt < MAX_CLASS_CODE_ATTEMPTS; attempt += 1) {
    const payload = {
      name,
      owner_id: auth.user.id,
      class_code: makeClassCode(),
      institution_school_code: institution.schoolCode
    }

    const { data, error } = await auth.supabase
      .from('classes')
      .insert(payload)
      .select('id,name,owner_id,class_code,institution_school_code,institution_program_id,institution_cohort_id,created_at')
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

export async function handleFindClassByCode(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const code = normalizeClassCode(c.req.param('code'))
  if (!code) {
    return c.json({ error: 'Valid class code required' }, 400)
  }

  const { data, error } = await auth.supabase
    .from('classes')
    .select('id,name')
    .eq('class_code', code)
    .maybeSingle()

  if (error) {
    console.error('Class lookup failed:', error.message || error)
    return c.json({ error: 'Unable to look up class' }, 500)
  }

  return c.json({ class: joinableClass(data) }, 200)
}

export async function handleEnrollInClass(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const classId = c.req.param('classId')
  const code = normalizeClassCode(body?.code)
  if (!classId || !code) {
    return c.json({ error: 'class code required to join' }, 400)
  }

  const { data: cls, error: classError } = await auth.supabase
    .from('classes')
    .select('id,class_code,institution_school_code')
    .eq('id', classId)
    .maybeSingle()

  if (classError) {
    console.error('Class enrollment lookup failed:', classError.message || classError)
    return c.json({ error: 'Unable to enroll in class' }, 500)
  }
  if (!cls) return c.json({ error: 'Class not found' }, 404)
  if (code !== cls.class_code) return c.json({ error: 'Invalid class code' }, 403)

  // Eligibility is resolved from the class's own institution and the verified token identity,
  // and only after the caller has proven knowledge of the class code. It runs strictly before
  // the service-role insert below, which bypasses RLS and therefore performs no checks itself.
  const eligibility = await resolveEnrollmentEligibility(auth, cls)
  if (!eligibility.allowed) {
    if (eligibility.status === 503) {
      console.error('Class enrollment eligibility lookup failed:', eligibility.reason)
      return c.json({ error: 'Unable to verify enrollment eligibility' }, 503)
    }
    console.warn('Class enrollment refused:', eligibility.reason, {
      classId: cls.id,
      userId: auth.user.id,
      institutionSchoolCode: cls.institution_school_code || null
    })
    return c.json({ error: 'Enrollment not permitted' }, 403)
  }

  const payload = {
    class_id: cls.id,
    user_id: auth.user.id
  }

  const { data, error } = await auth.supabase
    .from('enrollments')
    .insert(payload)
    .select('id,class_id,user_id,created_at')
    .single()

  if (!error) {
    return c.json({ success: true, enrollment: data }, 201)
  }

  if (error.code === '23505') {
    const { data: existing, error: existingError } = await auth.supabase
      .from('enrollments')
      .select('id,class_id,user_id,created_at')
      .eq('class_id', cls.id)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (!existingError && existing) {
      return c.json({ success: true, enrollment: existing, already_enrolled: true }, 200)
    }
  }

  console.error('Class enrollment failed:', error.message || error)
  return c.json({ error: 'Unable to enroll in class' }, 500)
}

export async function handleClassRoster(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeInstructor(c)
  if (auth.response) return auth.response

  const classId = c.req.param('classId')
  const { data: cls, error: classError } = await auth.supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('owner_id', auth.user.id)
    .maybeSingle()

  if (classError) {
    console.error('Class roster ownership check failed:', classError.message || classError)
    return c.json({ error: 'Unable to load class roster' }, 500)
  }
  if (!cls) return c.json({ error: 'Class not found' }, 404)

  const { data: enrollments, error: enrollmentError } = await auth.supabase
    .from('enrollments')
    .select('user_id,created_at')
    .eq('class_id', cls.id)
    .order('created_at', { ascending: true })

  if (enrollmentError) {
    console.error('Class roster enrollment lookup failed:', enrollmentError.message || enrollmentError)
    return c.json({ error: 'Unable to load class roster' }, 500)
  }

  const rows = enrollments || []
  const userIds = rows.map((row) => row.user_id).filter(Boolean)
  if (userIds.length === 0) return c.json({ students: [] }, 200)

  const { data: profiles, error: profileError } = await auth.supabase
    .from('profiles')
    .select('id,email')
    .in('id', userIds)

  if (profileError) {
    console.error('Class roster profile lookup failed:', profileError.message || profileError)
    return c.json({ error: 'Unable to load class roster' }, 500)
  }

  const byId = new Map((profiles || []).map((profile) => [profile.id, profile]))
  const students = rows.map((row) => {
    const profile = byId.get(row.user_id)
    return {
      id: row.user_id,
      email: profile?.email || null,
      enrolled_at: row.created_at
    }
  })

  return c.json({ students }, 200)
}

export {
  MAX_CLASS_NAME_LENGTH,
  normalizeClassName,
  normalizeClassCode,
  makeClassCode
}

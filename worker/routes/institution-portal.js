import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'

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

function publicMembership(row) {
  return {
    id: row.id,
    schoolCode: row.school_code,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function publicInstitution(row) {
  if (!row) return null
  return {
    schoolCode: row.school_code,
    schoolName: row.school_name,
    city: row.city,
    stateCode: row.state_code,
    province: row.province,
    country: row.country
  }
}

function publicProgram(row) {
  return {
    id: row.id,
    schoolCode: row.school_code,
    name: row.name,
    code: row.code,
    active: row.active
  }
}

function publicCohort(row) {
  return {
    id: row.id,
    schoolCode: row.school_code,
    programId: row.program_id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    active: row.active
  }
}

function publicClass(row) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    classCode: row.class_code,
    schoolCode: row.institution_school_code,
    programId: row.institution_program_id,
    cohortId: row.institution_cohort_id,
    createdAt: row.created_at
  }
}

export async function handleInstitutionMemberships(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const { data: memberships, error } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,role,status,created_at,updated_at')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .order('school_code', { ascending: true })

  if (error) {
    console.error('Institution membership lookup failed:', error.message || error)
    return c.json({ error: 'Unable to load institution memberships' }, 500)
  }

  const rows = memberships || []
  if (!rows.length) return c.json({ memberships: [] }, 200)

  const schoolCodes = [...new Set(rows.map((row) => row.school_code))]
  const { data: institutions, error: institutionError } = await auth.supabase
    .from('institutions')
    .select('school_code,school_name,city,state_code,province,country')
    .in('school_code', schoolCodes)

  if (institutionError) {
    console.error('Institution membership directory lookup failed:', institutionError.message || institutionError)
    return c.json({ error: 'Unable to load institution memberships' }, 500)
  }

  const institutionByCode = new Map((institutions || []).map((row) => [row.school_code, row]))
  return c.json({
    memberships: rows.map((row) => ({
      ...publicMembership(row),
      institution: publicInstitution(institutionByCode.get(row.school_code) || null)
    }))
  }, 200)
}

export async function handleInstitutionPortal(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeAuthenticated(c)
  if (auth.response) return auth.response

  const schoolCode = String(c.req.query('schoolCode') || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(schoolCode)) {
    return c.json({ error: 'Valid institution schoolCode required' }, 400)
  }

  const { data: membership, error: membershipError } = await auth.supabase
    .from('institution_memberships')
    .select('id,school_code,user_id,role,status,created_at,updated_at')
    .eq('school_code', schoolCode)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) {
    console.error('Institution portal membership lookup failed:', membershipError.message || membershipError)
    return c.json({ error: 'Unable to authorize institution portal' }, 500)
  }
  if (!membership) return c.json({ error: 'Active institution membership required' }, 403)

  const [{ data: institution, error: institutionError }, { data: programs, error: programsError }, { data: cohorts, error: cohortsError }] = await Promise.all([
    auth.supabase
      .from('institutions')
      .select('school_code,school_name,city,state_code,province,country')
      .eq('school_code', schoolCode)
      .maybeSingle(),
    auth.supabase
      .from('institution_programs')
      .select('id,school_code,name,code,active')
      .eq('school_code', schoolCode)
      .order('name', { ascending: true }),
    auth.supabase
      .from('institution_cohorts')
      .select('id,school_code,program_id,name,starts_on,ends_on,active')
      .eq('school_code', schoolCode)
      .order('name', { ascending: true })
  ])

  if (institutionError || programsError || cohortsError) {
    console.error('Institution portal tenant lookup failed:', institutionError?.message || programsError?.message || cohortsError?.message)
    return c.json({ error: 'Unable to load institution portal' }, 500)
  }

  let classQuery = auth.supabase
    .from('classes')
    .select('id,name,owner_id,class_code,institution_school_code,institution_program_id,institution_cohort_id,created_at')
    .eq('institution_school_code', schoolCode)
    .order('created_at', { ascending: false })

  if (membership.role === 'instructor') {
    classQuery = classQuery.eq('owner_id', auth.user.id)
  } else if (!['institution_admin', 'institution_owner'].includes(membership.role)) {
    return c.json({
      membership: publicMembership(membership),
      institution: publicInstitution(institution),
      programs: (programs || []).map(publicProgram),
      cohorts: (cohorts || []).map(publicCohort),
      classes: [],
      administrationGranted: false
    }, 200)
  }

  const { data: classes, error: classesError } = await classQuery
  if (classesError) {
    console.error('Institution portal class lookup failed:', classesError.message || classesError)
    return c.json({ error: 'Unable to load institution portal' }, 500)
  }

  return c.json({
    membership: publicMembership(membership),
    institution: publicInstitution(institution),
    programs: (programs || []).map(publicProgram),
    cohorts: (cohorts || []).map(publicCohort),
    classes: (classes || []).map(publicClass),
    administrationGranted: ['institution_admin', 'institution_owner'].includes(membership.role)
  }, 200)
}

const PRIVILEGED_ROLE_ALIASES = Object.freeze({
  teacher: 'instructor',
  instructor: 'instructor',
  professor: 'instructor',
  admin: 'admin'
})

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase()
}

function canonicalPrivilegedRole(value) {
  return PRIVILEGED_ROLE_ALIASES[normalizeRole(value)] || null
}

function isInstructorRole(value) {
  return canonicalPrivilegedRole(value) === 'instructor'
}

function isAdminRole(value) {
  return canonicalPrivilegedRole(value) === 'admin'
}

function isInstructorOrAdminRole(value) {
  return canonicalPrivilegedRole(value) !== null
}

async function resolveTrustedRole(user, supabase) {
  const metadataRole = canonicalPrivilegedRole(user?.app_metadata?.role)
  if (metadataRole) return metadataRole
  if (!user?.id || !supabase) return null

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Trusted role lookup failed:', error.message || error)
      return null
    }

    const profileRole = canonicalPrivilegedRole(data?.role) || normalizeRole(data?.role) || null
    return profileRole
  } catch (error) {
    console.error('Trusted role lookup failed:', error?.message || error)
    return null
  }
}

export {
  PRIVILEGED_ROLE_ALIASES,
  normalizeRole,
  canonicalPrivilegedRole,
  isInstructorRole,
  isAdminRole,
  isInstructorOrAdminRole,
  resolveTrustedRole
}

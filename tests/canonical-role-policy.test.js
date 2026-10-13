/** @jest-environment node */
const {
  canonicalPrivilegedRole,
  isInstructorRole,
  isAdminRole,
  isInstructorOrAdminRole,
  resolveTrustedRole
} = require('../worker/auth/role-policy.js')

function profileClient(role, error = null) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({ data: role == null ? null : { role }, error }))
        }))
      }))
    }))
  }
}

describe('canonical privileged role policy', () => {
  test.each([
    ['teacher', 'instructor'],
    ['instructor', 'instructor'],
    ['professor', 'instructor'],
    ['ADMIN', 'admin'],
    [' student ', null],
    ['', null]
  ])('canonicalizes %p to %p', (input, expected) => {
    expect(canonicalPrivilegedRole(input)).toBe(expected)
  })

  test('privileged predicates use canonical aliases', () => {
    expect(isInstructorRole('teacher')).toBe(true)
    expect(isInstructorRole('professor')).toBe(true)
    expect(isAdminRole('admin')).toBe(true)
    expect(isInstructorOrAdminRole('student')).toBe(false)
  })

  test('trusted app_metadata privileged role wins without a profile lookup', async () => {
    const supabase = profileClient('student')
    await expect(resolveTrustedRole({ id: 'u1', app_metadata: { role: 'teacher' } }, supabase))
      .resolves.toBe('instructor')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  test('falls back to trusted profiles.role and canonicalizes legacy instructor aliases', async () => {
    await expect(resolveTrustedRole({ id: 'u1', app_metadata: { role: 'student' } }, profileClient('professor')))
      .resolves.toBe('instructor')
  })

  test('preserves a trusted non-privileged profile role without granting privilege', async () => {
    const role = await resolveTrustedRole({ id: 'u1', app_metadata: {} }, profileClient('student'))
    expect(role).toBe('student')
    expect(isInstructorOrAdminRole(role)).toBe(false)
  })

  test('never reads editable user_metadata as an authorization source', async () => {
    const role = await resolveTrustedRole({
      id: 'u1',
      app_metadata: {},
      user_metadata: { role: 'admin' }
    }, profileClient('student'))
    expect(role).toBe('student')
    expect(isAdminRole(role)).toBe(false)
  })

  test('fails closed on profile lookup errors', async () => {
    await expect(resolveTrustedRole({ id: 'u1', app_metadata: {} }, profileClient(null, { message: 'db unavailable' })))
      .resolves.toBeNull()
  })
})

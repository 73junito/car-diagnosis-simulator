const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'classroom-classes.js'), 'utf8')
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8')
)

describe('Worker classroom contract', () => {
  test('registers class list/create, lookup, self-enrollment, and roster on the canonical Worker', () => {
    expect(worker).toContain("handleListClasses")
    expect(worker).toContain("handleCreateClass")
    expect(worker).toContain("handleFindClassByCode")
    expect(worker).toContain("handleEnrollInClass")
    expect(worker).toContain("handleClassRoster")
    expect(worker).toContain("app.get('/api/classes', handleListClasses)")
    expect(worker).toContain("app.post('/api/classes', handleCreateClass)")
    expect(worker).toContain("app.get('/api/classes/by-code/:code', handleFindClassByCode)")
    expect(worker).toContain("app.post('/api/classes/:classId/enroll', handleEnrollInClass)")
    expect(worker).toContain("app.get('/api/classes/:classId/students', handleClassRoster)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('requires verified bearer identity and trusted instructor role for owner operations', () => {
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole(auth.user, auth.supabase)')
    expect(route).toContain('isInstructorRole(role)')
    expect(route).toContain("c.json({ error: 'Authentication required' }, 401)")
    expect(route).toContain("c.json({ error: 'Instructor access required' }, 403)")
  })

  test('scopes class ownership and never accepts client-supplied owner or enrollment user ids', () => {
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain('owner_id: auth.user.id')
    expect(route).toContain('user_id: auth.user.id')
    expect(route).not.toContain('body?.owner_id')
    expect(route).not.toContain('body.owner_id')
    expect(route).not.toContain('body?.userId')
    expect(route).not.toContain('body.userId')
  })

  test('requires an authenticated exact class-code match before self-enrollment', () => {
    expect(route).toContain("normalizeClassCode(c.req.param('code'))")
    expect(route).toContain("normalizeClassCode(body?.code)")
    expect(route).toContain("if (code !== cls.class_code)")
    expect(route).toContain("c.json({ error: 'Invalid class code' }, 403)")
    expect(route).toContain(".from('enrollments')")
    expect(route).toContain("error.code === '23505'")
    expect(route).toContain('already_enrolled: true')
  })

  test('returns only minimal joinable class metadata and minimal owner-scoped roster identity', () => {
    expect(route).toContain('function joinableClass(row)')
    expect(route).toContain('id: row.id')
    expect(route).toContain('name: row.name')
    expect(route).toContain(".select('id,email')")
    expect(route).toContain('enrolled_at: row.created_at')
    expect(route).not.toContain(".from('users')")
  })

  test('validates class names and generates server-owned class codes', () => {
    expect(route).toContain('const MAX_CLASS_NAME_LENGTH = 120')
    expect(route).toContain("const CLASS_CODE_LENGTH = 6")
    expect(route).toContain('crypto.getRandomValues(values)')
    expect(route).toContain('class_code: makeClassCode()')
  })

  test('removes implemented classroom browser routes from the known-unregistered G2 baseline', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    expect(patterns).not.toContain('/api/classes')
    expect(patterns).not.toContain('/api/classes/by-code/:param')
    expect(patterns).not.toContain('/api/classes/:param/enroll')
    expect(patterns).toContain('/api/teacher/data')
  })
})

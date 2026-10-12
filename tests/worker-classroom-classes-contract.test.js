const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'classroom-classes.js'), 'utf8')
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8')
)

describe('Worker classroom class list/create contract', () => {
  test('registers GET and POST /api/classes on the canonical production Worker', () => {
    expect(worker).toContain("import { handleListClasses, handleCreateClass } from \"./routes/classroom-classes.js\";")
    expect(worker).toContain("app.get('/api/classes', handleListClasses)")
    expect(worker).toContain("app.post('/api/classes', handleCreateClass)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('requires verified bearer identity and trusted instructor role', () => {
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole(user, supabase)')
    expect(route).toContain('isInstructorRole(role)')
    expect(route).toContain("c.json({ error: 'Authentication required' }, 401)")
    expect(route).toContain("c.json({ error: 'Instructor access required' }, 403)")
  })

  test('scopes class reads and writes to the authenticated owner', () => {
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain('owner_id: auth.user.id')
    expect(route).not.toContain('body?.owner_id')
    expect(route).not.toContain('body.owner_id')
  })

  test('validates class names and generates server-owned class codes', () => {
    expect(route).toContain('const MAX_CLASS_NAME_LENGTH = 120')
    expect(route).toContain("const CLASS_CODE_LENGTH = 6")
    expect(route).toContain('crypto.getRandomValues(values)')
    expect(route).toContain('class_code: makeClassCode()')
    expect(route).toContain("error.code === '23505'")
  })

  test('removes /api/classes from the known-unregistered G2 baseline', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    expect(patterns).not.toContain('/api/classes')
    expect(patterns).toContain('/api/classes/by-code/:param')
    expect(patterns).toContain('/api/classes/:param/enroll')
  })
})

const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8')
const classesRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'classroom-classes.js'), 'utf8')
const assignmentsRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'classroom-assignments.js'), 'utf8')
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8')
)

describe('G2 classroom isolation closeout', () => {
  test('production browser code no longer references the legacy teacher aggregate', () => {
    expect(script).not.toContain('/api/teacher/data')
  })

  test('legacy teacher compatibility view uses only owned classes and owned-class roster endpoints', () => {
    expect(script).toContain("apiGet('/api/classes')")
    expect(script).toContain("'/api/classes/' + encodeURIComponent(currentClassId) + '/students'")
  })

  test('roster reads require instructor authorization and class ownership', () => {
    expect(classesRoute).toContain('const auth = await authorizeInstructor(c)')
    expect(classesRoute).toContain(".eq('id', classId)")
    expect(classesRoute).toContain(".eq('owner_id', auth.user.id)")
    expect(classesRoute).toContain("if (!cls) return c.json({ error: 'Class not found' }, 404)")
  })

  test('targeted assignments require owned-class enrollment for every student', () => {
    expect(assignmentsRoute).toContain(".eq('owner_id', auth.user.id)")
    expect(assignmentsRoute).toContain(".eq('class_id', cls.id)")
    expect(assignmentsRoute).toContain(".in('user_id', studentIds)")
    expect(assignmentsRoute).toContain('invalidStudentIds.length > 0')
    expect(assignmentsRoute).toContain('All targeted students must be enrolled in the class')
  })

  test('G2 contains no remaining known production gaps', () => {
    const g2 = inventory.knownUnregisteredRoutes.filter((entry) => entry.gap === 'G2')
    expect(g2).toEqual([])
  })

  test('legacy completion and replay debt remains visible under G17', () => {
    const byPattern = new Map(inventory.knownUnregisteredRoutes.map((entry) => [entry.pattern, entry]))
    expect(byPattern.get('/api/complete')?.gap).toBe('G17')
    expect(byPattern.get('/api/replay')?.gap).toBe('G17')
  })
})

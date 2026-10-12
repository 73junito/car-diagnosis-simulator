const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'classroom-assignments.js'), 'utf8')

describe('Worker classroom assignment contract', () => {
  test('registers assignment creation on the canonical production Worker', () => {
    expect(worker).toContain('handleCreateAssignment')
    expect(worker).toContain("app.use('/api/assign', classroomCors)")
    expect(worker).toContain("app.post('/api/assign', handleCreateAssignment)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('requires verified instructor identity', () => {
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole(user, supabase)')
    expect(route).toContain('isInstructorRole(role)')
    expect(route).toContain("c.json({ error: 'Authentication required' }, 401)")
    expect(route).toContain("c.json({ error: 'Instructor access required' }, 403)")
  })

  test('requires an owned class before assignment persistence', () => {
    expect(route).toContain(".from('classes')")
    expect(route).toContain(".eq('id', classId)")
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain("c.json({ error: 'Class not found' }, 404)")
  })

  test('validates targeted students against class enrollment and rejects cross-class targets', () => {
    expect(route).toContain(".from('enrollments')")
    expect(route).toContain(".eq('class_id', cls.id)")
    expect(route).toContain(".in('user_id', studentIds)")
    expect(route).toContain('invalidStudentIds.length > 0')
    expect(route).toContain("All targeted students must be enrolled in the class")
  })

  test('never accepts an owner id and persists only normalized assignment fields', () => {
    expect(route).not.toContain('owner_id: body')
    expect(route).not.toContain('body?.owner_id')
    expect(route).toContain('system,')
    expect(route).toContain('scenario_ids: scenarioIds')
    expect(route).toContain('assigned_to: studentIds')
    expect(route).toContain('class_id: cls.id')
  })

  test('bounds assignment payload size and preserves string or numeric scenario ids', () => {
    expect(route).toContain('const MAX_SYSTEM_LENGTH = 120')
    expect(route).toContain('const MAX_SCENARIOS_PER_ASSIGNMENT = 100')
    expect(route).toContain('const MAX_STUDENTS_PER_ASSIGNMENT = 500')
    expect(route).toContain("typeof raw !== 'string' && typeof raw !== 'number'")
  })
})

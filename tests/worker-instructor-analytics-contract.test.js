const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'instructor-analytics.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'analytics.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'analytics.js'), 'utf8')
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'config', 'production-api-route-inventory.json'), 'utf8'))

describe('Worker instructor student analytics contract', () => {
  test('registers the canonical Worker route with authenticated CORS', () => {
    expect(worker).toContain('handleInstructorStudentAnalytics')
    expect(worker).toContain("app.use('/api/analytics/students', instructorAnalyticsCors)")
    expect(worker).toContain("app.get('/api/analytics/students', handleInstructorStudentAnalytics)")
    expect(worker).toContain("app.get('/api/analytics/sessions', handleInstructorSessionAnalytics)")
    expect(worker).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('requires verified instructor identity and an explicit class scope', () => {
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('resolveTrustedRole(user, supabase)')
    expect(route).toContain('isInstructorRole(role)')
    expect(route).toContain("c.req.query('classId')")
    expect(route).toContain("c.json({ error: 'classId is required' }, 400)")
  })

  test('verifies class ownership before cross-user analytics reads', () => {
    expect(route).toContain(".from('classes')")
    expect(route).toContain(".eq('id', classId)")
    expect(route).toContain(".eq('owner_id', auth.user.id)")
    expect(route).toContain("c.json({ error: 'Class not found' }, 404)")
  })

  test('limits analytics population to students enrolled in the owned class', () => {
    expect(route).toContain(".from('enrollments')")
    expect(route).toContain(".eq('class_id', cls.id)")
    expect(route).toContain(".in('user_id', userIds)")
    expect(route).toContain(".from('attempts')")
    expect(route).toContain(".from('attempt_answers')")
  })

  test('never returns answer-level correctness or student answers', () => {
    expect(route).toContain("select('attempt_id,is_correct')")
    expect(route).not.toContain('student_answer')
    expect(route).toContain('answerAccuracy')
    expect(route).not.toContain('is_correct:')
  })

  test('uses owned classes and the shared authenticated API client in the UI', () => {
    expect(html).toContain('id="analytics-class"')
    expect(html).toContain('<script src="/auth.js"></script>')
    expect(html).toContain('<script src="/apiClient.js"></script>')
    expect(ui).toContain("window.apiGet('/api/classes')")
    expect(ui).toContain("window.apiGet('/api/analytics/students?classId=' + encodeURIComponent(classId))")
    expect(ui).toContain("window.apiGet('/api/analytics/sessions?classId=' + encodeURIComponent(classId))")
    expect(ui).toContain("window.location.replace('/sign-in/instructor/')")
  })

  test('session summary is truthful about governed source availability', () => {
    expect(route).toContain('function buildSessionSummary(attempts)')
    expect(route).toContain("attempt.status === 'completed'")
    expect(route).toContain('completionRate:')
    expect(route).toContain('averageTime:')
    expect(route).toContain('averageConfidence: null')
    expect(route).toContain('safetyMisses: null')
    expect(route).not.toContain('confidence: 0')
    expect(route).not.toContain('safetyMisses: 0')
  })

  test('removes implemented analytics routes from known production gaps', () => {
    const patterns = inventory.knownUnregisteredRoutes.map((entry) => entry.pattern)
    expect(patterns).not.toContain('/api/analytics/students')
    expect(patterns).not.toContain('/api/analytics/sessions')
    expect(patterns).toContain('/api/analytics/export')
  })
})

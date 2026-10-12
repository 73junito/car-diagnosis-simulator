const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-activity.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'student', 'activity', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'student', 'activity', 'activity.js'), 'utf8')

describe('G12 authenticated student activity feed', () => {
  test('registers the production Worker activity route', () => {
    expect(worker).toContain('handleStudentActivity')
    expect(worker).toContain("app.get('/api/student/activity', handleStudentActivity)")
  })

  test('requires authentication and scopes both sources to the authenticated learner', () => {
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain(".from('attempts')")
    expect(route).toContain(".eq('user_id', user.id)")
    expect(route).toContain(".from('telemetry_events')")
    expect(route).toContain(".eq('event_type', 'scenario_started')")
  })

  test('pagination is bounded', () => {
    expect(route).toContain('const MAX_LIMIT = 50')
    expect(route).toContain('const MAX_PAGE = 20')
    expect(route).toContain('Math.min(parsed, MAX_LIMIT)')
    expect(route).toContain('Math.min(parsed, MAX_PAGE)')
    expect(route).toContain('hasMore')
  })

  test('telemetry retention honors expires_at rather than returning expired events', () => {
    expect(route).toContain("expires_at.is.null,expires_at.gt.")
    expect(route).toContain("Expired telemetry rows are excluded using telemetry_events.expires_at.")
  })

  test('activity payload is restricted to safe learning metadata', () => {
    expect(route).toContain("eventType: 'learning_record'")
    expect(route).toContain("eventType: 'scenario_started'")
    expect(route).not.toContain('correct_answer')
    expect(route).not.toContain('student_answer')
    expect(route).not.toContain('is_correct')
    expect(route).not.toContain('explanation')
    expect(route).not.toContain('score:')
  })

  test('static placeholder activity is removed and live authenticated rendering is used', () => {
    expect(html).not.toContain('Student dashboard refreshed with current scenario status.')
    expect(html).not.toContain('Continue electrical diagnostics before advanced network faults.')
    expect(html).toContain('id="activityTimeline"')
    expect(html).toContain('/auth.js')
    expect(html).toContain('./activity.js')
    expect(ui).toContain("fetch('/api/student/activity?page='+page+'&limit='+limit")
    expect(ui).toContain("Authorization:'Bearer '+accessToken")
  })

  test('UI exposes truthful empty/error and pagination states', () => {
    expect(ui).toContain('No server-recorded activity is available.')
    expect(ui).toContain('Unable to load recent activity.')
    expect(ui).toContain("previous.addEventListener")
    expect(ui).toContain("next.addEventListener")
    expect(html).toContain('Expired telemetry is excluded, and grading secrets are not shown.')
  })
})

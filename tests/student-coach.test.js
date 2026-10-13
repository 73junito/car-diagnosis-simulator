const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const route = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-recommendations.js'), 'utf8')
const worker = fs.readFileSync(path.join(root, 'worker', 'index.js'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'student', 'coach', 'index.html'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'dashboard', 'student', 'coach', 'coach.js'), 'utf8')

describe('G13 live student Coach', () => {
  test('uses the production authenticated recommendation route', () => {
    expect(worker).toContain("app.get('/api/student/recommendations', handleStudentRecommendations)")
    expect(route).toContain('extractBearerToken')
    expect(route).toContain('verifySupabaseToken')
  })

  test('derives recommendations only from authenticated learner training attempts', () => {
    expect(route).toContain("const PRACTICE_MODE = 'training'")
    expect(route).toContain(".eq('user_id', user.id)")
    expect(route).toContain(".eq('delivery_mode', PRACTICE_MODE)")
    expect(route).toContain(".from('attempt_answers')")
    expect(route).toContain(".eq('user_id', user.id)")
  })

  test('does not use assessment data for recommendation generation', () => {
    expect(route).toContain('assessmentDataUsed: false')
    expect(route).not.toContain("independent_non_proctored_assessment")
    expect(route).not.toContain('assessment_score')
  })

  test('returns bounded safe recommendation metadata with provenance', () => {
    expect(route).toContain('const MAX_RECOMMENDATIONS = 3')
    expect(route).toContain("source: 'training_progress'")
    expect(route).toContain("basis: 'aggregate_practice_performance'")
    expect(route).toContain("generatedBy: 'server_rule'")
    expect(route).not.toContain('correct_response_count')
    expect(route).not.toContain('correct_responses:')
    expect(route).not.toContain('is_correct:')
    expect(route).not.toContain('student_answer')
    expect(route).not.toContain('correct_answer')
    expect(route).not.toContain('answer_key')
  })

  test('static Coach sample content is removed', () => {
    expect(html).not.toContain('Recommended next:</strong> Charging System')
    expect(html).not.toContain('Voltage-drop reasoning')
    expect(html).not.toContain('Complete one intermediate scenario')
    expect(html).toContain('id="coachRecommendations"')
    expect(html).toContain('./coach.js')
  })

  test('Coach UI authenticates and renders provenance/context', () => {
    expect(ui).toContain("fetch('/api/student/recommendations'")
    expect(ui).toContain("Authorization:'Bearer '+accessToken")
    expect(ui).toContain('row.provenance?.source')
    expect(ui).toContain('row.provenance?.basis')
    expect(ui).toContain("'/dashboard/student/?scenario='+encodeURIComponent(row.scenario_id)")
  })

  test('Coach UI has truthful signed-out, empty, and unavailable states', () => {
    expect(ui).toContain('Sign in to view Coach recommendations.')
    expect(ui).toContain('No recommendation is available yet.')
    expect(ui).toContain('Complete training activity to give the Coach enough history for a recommendation.')
    expect(ui).toContain('Coach recommendations are currently unavailable.')
  })
})

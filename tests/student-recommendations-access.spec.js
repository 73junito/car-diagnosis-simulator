const fs = require('fs')
const path = require('path')

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('student recommendation retirement boundary', () => {
  const dashboard = read('dashboard/student/student.js')
  const apiRoute = read('api/student/recommendations.js')
  const workerRoute = read('worker/routes/student-recommendations.js')
  const workerIndex = read('worker/index.js')
  const migration = read('supabase/migrations/20260930175711_retire_legacy_student_recommendations.sql')

  test('dashboard keeps the authenticated application API contract', () => {
    expect(dashboard).toContain("fetch('/api/student/recommendations'")
    expect(dashboard).toContain('Authorization: `Bearer ${token}`')
    expect(dashboard).not.toContain('/rest/v1/student_recommendations')
  })

  test('server boundaries authenticate but no longer read the legacy table', () => {
    for (const code of [apiRoute, workerRoute]) {
      expect(code).toContain('extractBearerToken')
      expect(code).toContain('verifySupabaseToken')
      expect(code).toContain('recommendations: []')
      expect(code).not.toContain(".from('student_recommendations')")
    }
  })
  test('worker route remains GET-only with Authorization allowed', () => {
    expect(workerIndex).toContain("app.get('/api/student/recommendations', handleStudentRecommendations)")
    expect(workerIndex).toContain("allowMethods: ['GET', 'OPTIONS']")
    expect(workerIndex).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('retirement migration is guarded and never cascades', () => {
    expect(migration).toContain("to_regclass('public.student_recommendations')")
    expect(migration).toContain('legacy_rows <> 6')
    expect(migration).toContain("student_id is distinct from 'anonymous'")
    expect(migration).toContain('external_fk_count <> 0')
    expect(migration).toContain('dependent_view_count <> 0')
    expect(migration).toContain('user_trigger_count <> 0')
    expect(migration).toContain('routine_ref_count <> 0')
    expect(migration).toContain('drop table public.student_recommendations restrict')
    expect(migration).not.toMatch(/cascade/i)
  })
})

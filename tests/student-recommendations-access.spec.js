const fs = require('fs')
const path = require('path')

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('student recommendation access boundary', () => {
  const dashboard = read('dashboard/student/student.js')
  const apiRoute = read('api/student/recommendations.js')
  const workerRoute = read('worker/routes/student-recommendations.js')
  const workerIndex = read('worker/index.js')
  const migration = read('supabase/migrations/20260930045405_restrict_legacy_student_recommendations_access.sql')

  test('dashboard uses authenticated application API instead of direct table REST access', () => {
    expect(dashboard).toContain("fetch('/api/student/recommendations'")
    expect(dashboard).toContain('Authorization: `Bearer ${token}`')
    expect(dashboard).not.toContain('/rest/v1/student_recommendations')
  })

  test('server boundaries require bearer authentication and return only approved fields', () => {
    for (const code of [apiRoute, workerRoute]) {
      expect(code).toContain('extractBearerToken')
      expect(code).toContain('verifySupabaseToken')
      expect(code).toContain(".select('scenario_id,reason,priority')")
      expect(code).toContain(".eq('student_id', 'anonymous')")
      expect(code).not.toMatch(/student_id:\s*row\.student_id/)
      expect(code).not.toMatch(/competency_code/)
      expect(code).toContain("code === 'PGRST205'")
      expect(code).toContain("code === '42P01'")
    }
  })

  test('worker route permits Authorization header and exposes only GET', () => {
    expect(workerIndex).toContain("app.get('/api/student/recommendations', handleStudentRecommendations)")
    expect(workerIndex).toContain("allowMethods: ['GET', 'OPTIONS']")
    expect(workerIndex).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('migration revokes public table access without recreating the legacy table', () => {
    expect(migration).toContain("to_regclass('public.student_recommendations')")
    expect(migration).toContain('revoke all privileges on table public.student_recommendations from anon, authenticated')
    expect(migration).toContain('grant all privileges on table public.student_recommendations to service_role')
    expect(migration).not.toMatch(/create\s+table/i)
  })
})

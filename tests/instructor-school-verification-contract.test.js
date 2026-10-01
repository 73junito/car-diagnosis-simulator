import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261001033126_add_instructor_school_verification.sql'),
  'utf8'
)
const route = fs.readFileSync(
  path.join(root, 'worker/routes/instructor-verification.js'),
  'utf8'
)
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')
const researchRoute = fs.readFileSync(
  path.join(root, 'worker/routes/semantic-scholar-research.js'),
  'utf8'
)
const publicHome = fs.readFileSync(path.join(root, 'public-site/index.html'), 'utf8')
const buildScript = fs.readFileSync(path.join(root, 'scripts/build-static-site.js'), 'utf8')

describe('instructor school verification contract', () => {
  test('creates server-only institution and affiliation-review tables', () => {
    expect(migration).toContain('create table if not exists public.institutions')
    expect(migration).toContain('create table if not exists public.instructor_verification_requests')
    expect(migration).toContain("status in ('pending','approved','rejected')")
    expect(migration).toContain('school_code_plus_affiliation_review')
    expect(migration).toContain('enable row level security')
  })


  test('requires authenticated server-side school lookup and never grants a role', () => {
    expect(route).toContain('verifySupabaseToken')
    expect(route).toContain('findFederalSchoolByCode')
    expect(route).toContain("status: 'pending'")
    expect(route).toContain('authorizationGranted: false')
    expect(route).not.toContain("update({ role:")
    expect(route).not.toContain(".from('profiles').update")
  })

  test('requires approved affiliation for non-admin instructor research access', () => {
    expect(researchRoute).toContain("from('instructor_verification_requests')")
    expect(researchRoute).toContain(".select('status')")
    expect(researchRoute).toContain("data?.status !== 'approved'")
    expect(researchRoute).toContain('Verified instructor affiliation required')
  })

  test('exposes separate student and instructor sign-in entry points', () => {
    expect(publicHome).toContain('Student Sign In')
    expect(publicHome).toContain('Instructor Sign In')
    expect(publicHome).toContain('https://app.autolearnpro.com/sign-in/student/')
    expect(publicHome).toContain('https://app.autolearnpro.com/sign-in/instructor/')
  })


  test('ships sign-in pages in the app static build', () => {
    for (const expected of [
      '"sign-in"',
      '"sign-in/student/index.html"',
      '"sign-in/instructor/index.html"',
      '"dashboard/instructor/index.html"'
    ]) {
      expect(buildScript).toContain(expected)
    }
  })

  test('registers authenticated verification endpoints', () => {
    expect(workerIndex).toContain("app.get('/api/instructor/verification/institution'")
    expect(workerIndex).toContain("app.post('/api/instructor/verification/request'")
    expect(workerIndex).toContain("app.get('/api/instructor/verification/status'")
    expect(workerIndex).toContain("allowHeaders: ['Content-Type', 'Authorization']")
  })

  test('uses the generated 2026-27 federal directory without exposing it as a static asset', () => {
    const dataModule = fs.readFileSync(
      path.join(root, 'worker/data/federal-school-codes.js'),
      'utf8'
    )
    expect(dataModule).toContain('FEDERAL_SCHOOL_CODE_RECORD_COUNT = 6547')
    expect(buildScript).not.toContain('worker/data/federal-school-codes.js')
  })
})

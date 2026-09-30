'use strict'

const fs = require('fs')
const path = require('path')

const root = process.cwd()
const dashboard = fs.readFileSync(path.join(root, 'dashboard', 'student', 'student.js'), 'utf8')
const apiRoute = fs.readFileSync(path.join(root, 'api', 'student', 'recommendations.js'), 'utf8')
const workerRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-recommendations.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260930162957_restrict_legacy_student_recommendations_access.sql'),
  'utf8'
)

function fail(message) {
  console.error('[FAIL] Student recommendation access: ' + message)
  process.exit(1)
}

if (dashboard.includes('/rest/v1/student_recommendations')) {
  fail('dashboard must not read the legacy recommendation table directly')
}
if (!dashboard.includes("fetch('/api/student/recommendations'")) {
  fail('dashboard must use the application recommendation endpoint')
}

for (const [name, code] of [['api', apiRoute], ['worker', workerRoute]]) {
  if (!code.includes('extractBearerToken') || !code.includes('verifySupabaseToken')) {
    fail(name + ' recommendation route must require verified bearer authentication')
  }
  if (!code.includes(".select('scenario_id,reason,priority')")) {
    fail(name + ' recommendation route must select only approved response fields')
  }
  if (code.includes('competency_code')) {
    fail(name + ' recommendation route must not expose legacy taxonomy')
  }
  if (!code.includes("code === 'PGRST205'") || !code.includes("code === '42P01'")) {
    fail(name + ' recommendation route must tolerate an intentionally absent legacy table')
  }
}

if (!migration.includes("to_regclass('public.student_recommendations')")) {
  fail('migration must be safe when the legacy table is absent')
}
if (!migration.includes('revoke all privileges on table public.student_recommendations from anon, authenticated')) {
  fail('migration must revoke anon/authenticated table privileges')
}
if (!migration.includes('grant all privileges on table public.student_recommendations to service_role')) {
  fail('migration must preserve service-role access')
}
if (/create\s+table/i.test(migration)) {
  fail('migration must not recreate the legacy recommendation table')
}

console.log('[PASS] Student recommendation access: authenticated server boundary + public table revocation')

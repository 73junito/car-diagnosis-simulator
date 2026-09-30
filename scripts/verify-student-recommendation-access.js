'use strict'

const fs = require('fs')
const path = require('path')

const root = process.cwd()
const dashboard = fs.readFileSync(path.join(root, 'dashboard', 'student', 'student.js'), 'utf8')
const apiRoute = fs.readFileSync(path.join(root, 'api', 'student', 'recommendations.js'), 'utf8')
const workerRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-recommendations.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260930175711_retire_legacy_student_recommendations.sql'),
  'utf8'
)

function fail(message) {
  console.error('[FAIL] Student recommendation retirement: ' + message)
  process.exit(1)
}

if (dashboard.includes('/rest/v1/student_recommendations')) {
  fail('dashboard must not read the legacy recommendation table directly')
}
if (!dashboard.includes("fetch('/api/student/recommendations'")) {
  fail('dashboard must keep using the authenticated application endpoint')
}

for (const [name, code] of [['api', apiRoute], ['worker', workerRoute]]) {
  if (!code.includes('extractBearerToken') || !code.includes('verifySupabaseToken')) {
    fail(name + ' route must require verified bearer authentication')
  }
  if (code.includes(".from('student_recommendations')")) {
    fail(name + ' route must not read the retired legacy source')
  }
  if (!code.includes('recommendations: []')) {
    fail(name + ' route must preserve the empty recommendation response contract')
  }
}
if (!migration.includes("to_regclass('public.student_recommendations')")) {
  fail('retirement migration must be safe when the legacy table is absent')
}
for (const guard of ['legacy_rows <> 6', 'external_fk_count <> 0', 'dependent_view_count <> 0', 'user_trigger_count <> 0', 'routine_ref_count <> 0']) {
  if (!migration.includes(guard)) fail('missing retirement guard: ' + guard)
}
if (!migration.includes("student_id is distinct from 'anonymous'")) {
  fail('retirement migration must fail closed on non-anonymous rows')
}
if (!migration.includes('drop table public.student_recommendations restrict')) {
  fail('retirement migration must use RESTRICT')
}
if (/cascade/i.test(migration)) {
  fail('retirement migration must never use CASCADE')
}

console.log('[PASS] Student recommendation retirement: authenticated empty boundary + guarded legacy retirement')

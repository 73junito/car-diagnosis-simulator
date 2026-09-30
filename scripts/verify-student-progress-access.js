'use strict'

const fs = require('fs')
const path = require('path')

const root = process.cwd()
const dashboard = fs.readFileSync(path.join(root, 'dashboard', 'student', 'student.js'), 'utf8')
const apiRoute = fs.readFileSync(path.join(root, 'api', 'student', 'progress.js'), 'utf8')
const workerRoute = fs.readFileSync(path.join(root, 'worker', 'routes', 'student-progress.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260930163022_restrict_legacy_student_summary_views.sql'),
  'utf8'
)

function fail(message) {
  console.error('[FAIL] Student progress access: ' + message)
  process.exit(1)
}

if (!dashboard.includes("fetch('/api/student/progress'")) {
  fail('dashboard must use authenticated student progress API')
}
for (const legacyPath of [
  '/rest/v1/student_performance_summary',
  '/rest/v1/student_transcript_summary'
]) {
  if (dashboard.includes(legacyPath)) fail('dashboard still references legacy summary view: ' + legacyPath)
}
if (dashboard.includes('transcript.student_id')) {
  fail('dashboard must not display a student identifier in transcript summary')
}
if (dashboard.includes('avg_time_seconds')) {
  fail('dashboard must not fabricate the legacy timing metric from canonical data')
}

for (const [name, code] of [['api', apiRoute], ['worker', workerRoute]]) {
  if (!code.includes('extractBearerToken') || !code.includes('verifySupabaseToken')) {
    fail(name + ' progress route must require verified bearer authentication')
  }
  if (!code.includes(".from('attempts')") || !code.includes(".from('attempt_answers')")) {
    fail(name + ' progress route must use canonical attempts and attempt_answers')
  }
  const ownerFilters = code.match(/\.eq\('user_id', user\.id\)/g) || []
  if (ownerFilters.length !== 2) {
    fail(name + ' progress route must scope both canonical queries to verified user id')
  }
  if (code.includes('question_attempts') || code.includes('student_performance_summary') || code.includes('student_transcript_summary')) {
    fail(name + ' progress route must not depend on legacy progress assets')
  }
}

for (const view of ['student_performance_summary', 'student_transcript_summary']) {
  if (!migration.includes("to_regclass('public." + view + "')")) {
    fail('migration must be safe when legacy view is absent: ' + view)
  }
  if (!migration.includes('revoke all privileges on table public.' + view + ' from anon, authenticated')) {
    fail('migration must revoke public privileges on legacy view: ' + view)
  }
}
if (/create\s+(or\s+replace\s+)?view/i.test(migration)) {
  fail('migration must not recreate legacy summary views')
}

console.log('[PASS] Student progress access: authenticated canonical API + legacy view revocation')

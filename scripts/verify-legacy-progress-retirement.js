'use strict'

const fs = require('fs')
const path = require('path')

const root = process.cwd()
const migrationPath = path.join(
  root,
  'supabase',
  'migrations',
  '20260930145732_retire_legacy_student_progress.sql'
)
const migration = fs.readFileSync(migrationPath, 'utf8')
const prompt = fs.readFileSync(path.join(root, 'prompts', 'ai-team', 'adaptive-learning.md'), 'utf8')
const runner = fs.readFileSync(path.join(root, 'tools', 'ai-team', 'run-agent.js'), 'utf8')
const scenario = fs.readFileSync(path.join(root, 'dashboard', 'student', 'scenario', 'scenario.js'), 'utf8')

function fail(message) {
  console.error('[FAIL] Legacy progress retirement: ' + message)
  process.exit(1)
}

for (const required of [
  "legacy_rows <> 80",
  "non_anonymous_rows <> 0",
  "external_fk_count <> 0",
  "direct_view_count <> 3",
  "second_level_view_count <> 1",
  "third_level_view_count <> 0",
  "drop view %I.%I restrict",
  "drop table public.question_attempts restrict"
]) {
  if (!migration.includes(required)) fail('missing fail-closed migration guard: ' + required)
}

if (/\bcascade\b/i.test(migration)) {
  fail('retirement migration must not use CASCADE')
}

if (!migration.includes("set local lock_timeout = '5s'")) {
  fail('retirement migration must set a lock timeout')
}
if (!migration.includes("set local statement_timeout = '30s'")) {
  fail('retirement migration must set a statement timeout')
}

for (const [name, code] of [
  ['adaptive-learning prompt', prompt],
  ['AI-team runner', runner],
  ['student scenario runtime', scenario]
]) {
  if (code.includes('question_attempts') || code.includes('student_transcript_summary')) {
    fail(name + ' still instructs or references retired legacy progress paths')
  }
}

console.log('[PASS] Legacy progress retirement: drift guards + RESTRICT-only destructive migration')

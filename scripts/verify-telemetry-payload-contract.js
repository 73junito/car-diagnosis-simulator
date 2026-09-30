'use strict'

const fs = require('fs')
const path = require('path')

const root = process.cwd()
const policyPath = path.join(root, 'docs', 'compliance', 'telemetry-payload-contract.json')
const runtimePath = path.join(root, 'api', 'telemetry', 'contract.js')
const migrationPath = path.join(
  root,
  'supabase',
  'migrations',
  '20260930040019_enforce_telemetry_payload_contract_and_ttl.sql'
)

function fail(message) {
  console.error('[FAIL] Telemetry payload contract: ' + message)
  process.exit(1)
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(label + ' must be a non-empty string')
  }
}

let policy
try {
  policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'))
} catch (error) {
  fail('invalid JSON: ' + error.message)
}

const runtime = fs.readFileSync(runtimePath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')

if (policy.version !== 1) fail('version must be 1')
requireString(policy.verified_at, 'verified_at')

if (policy.ttl_days !== 30) fail('ttl_days must be exactly 30')
if (policy.ttl_mode !== 'logical_expiry') fail('ttl_mode must be logical_expiry')

const ingress = policy.public_ingress || {}
if (!Array.isArray(ingress.allowed_top_level_fields)) {
  fail('allowed_top_level_fields must be an array')
}

const expectedTopLevel = ['session_id', 'event_type', 'payload_json']
for (const field of expectedTopLevel) {
  if (!ingress.allowed_top_level_fields.includes(field)) {
    fail('missing allowed top-level field: ' + field)
  }
}

const events = ingress.allowed_events || {}
const eventNames = Object.keys(events)
if (eventNames.length !== 1 || eventNames[0] !== 'scenario_started') {
  fail('scenario_started must be the only public event type')
}

if (!runtime.includes('const TELEMETRY_TTL_DAYS = 30')) {
  fail('runtime TTL constant must be 30 days')
}
if (!runtime.includes("'scenario_started'")) {
  fail('runtime must allow scenario_started')
}
if (!runtime.includes("'top_level_field_not_allowed'")) {
  fail('runtime must fail closed on unexpected top-level fields')
}
if (!runtime.includes("'payload_field_not_allowed'")) {
  fail('runtime must fail closed on unexpected payload fields')
}

if (!/add column if not exists expires_at timestamptz/i.test(migration)) {
  fail('migration must add expires_at')
}
if (!/created_at \+ interval '30 days'/i.test(migration)) {
  fail('migration must backfill expires_at from created_at + 30 days')
}
if (!/now\(\) \+ interval '30 days'/i.test(migration)) {
  fail('migration must default new rows to a 30-day expiry')
}
if (/\bdelete\s+from\s+public\.telemetry_events\b/i.test(migration)) {
  fail('migration must not physically delete telemetry rows')
}
if (/\btruncate\b/i.test(migration)) {
  fail('migration must not truncate data')
}
if (/cron\.schedule|create\s+extension\s+.*pg_cron/i.test(migration)) {
  fail('migration must not introduce scheduled purge automation')
}

if (!Array.isArray(policy.invariants) || policy.invariants.length === 0) {
  fail('at least one invariant is required')
}
if (!policy.invariants.includes('physical_purge_requires_separate_authorized_change')) {
  fail('physical purge authorization invariant is required')
}

console.log(
  '[PASS] Telemetry payload contract: scenario_started-only ingress, 30-day logical TTL, non-destructive migration'
)

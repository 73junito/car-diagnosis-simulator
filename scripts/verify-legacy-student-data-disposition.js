'use strict'

const fs = require('fs')
const path = require('path')

const registerPath = path.join(
  process.cwd(),
  'docs',
  'compliance',
  'legacy-student-data-disposition.json'
)

const allowedDispositions = new Set([
  'retain_active',
  'migrate_then_retire',
  'delete_after_verification',
  'retain_schema_clean_rows',
  'retire_empty_schema',
  'blocked'
])

function fail(message) {
  console.error('[FAIL] Legacy student-data disposition: ' + message)
  process.exit(1)
}

let register
try {
  register = JSON.parse(fs.readFileSync(registerPath, 'utf8'))
} catch (error) {
  fail('invalid JSON: ' + error.message)
}

if (register.version !== 1) fail('version must be 1')
if (register.production_mutation !== false) fail('P0.5 review must not authorize production mutation')

if (!Array.isArray(register.assets) || register.assets.length === 0) {
  fail('assets must be a non-empty array')
}

const ids = new Set()
for (const asset of register.assets) {
  if (!asset.id || !asset.system) fail('asset id/system required')
  if (ids.has(asset.id)) fail('duplicate asset id: ' + asset.id)
  ids.add(asset.id)

  if (!Number.isInteger(asset.rows) || asset.rows < 0) {
    fail(asset.id + '.rows must be a non-negative integer')
  }
  if (!allowedDispositions.has(asset.disposition)) {
    fail(asset.id + ' has unknown disposition: ' + asset.disposition)
  }
  if (!Array.isArray(asset.blockers)) fail(asset.id + '.blockers must be an array')
  if (!asset.next_action) fail(asset.id + '.next_action is required')
}

const rec = register.assets.find((asset) => asset.id === 'LD-003')
if (!rec || rec.disposition !== 'migrate_then_retire') {
  fail('legacy recommendations must be migrate_then_retire')
}
const recommendationAccess = register.production_facts?.recommendation_access
if (!recommendationAccess?.baseline_anon_select_policy) {
  fail('baseline anonymous recommendation read finding must remain explicit')
}
if (recommendationAccess.post_migration_anon_select_policy !== false) {
  fail('post-migration anonymous recommendation access must be false')
}
if (recommendationAccess.post_migration_dashboard_direct_rest_dependency !== false) {
  fail('post-migration dashboard direct REST dependency must be false')
}
if (recommendationAccess.authenticated_server_boundary !== true) {
  fail('authenticated recommendation server boundary must be recorded')
}

const classes = register.assets.find((asset) => asset.id === 'LD-008')
if (!classes || classes.disposition !== 'retain_schema_clean_rows') {
  fail('classroom schema must remain separate from orphan-row cleanup')
}

if (!Array.isArray(register.destructive_gates) || register.destructive_gates.length < 5) {
  fail('destructive gates are incomplete')
}
if (!Array.isArray(register.invariants) || register.invariants.length === 0) {
  fail('invariants are required')
}

console.log(
  '[PASS] Legacy student-data disposition: ' +
  register.assets.length +
  ' assets reviewed; no production mutation authorized'
)

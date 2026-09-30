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
  'retired_verified',
  'retirement_migration_prepared',
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

if (register.version !== 2) fail('version must be 2')
if (register.production_mutation !== true) fail('register must record the approved production retirement')
if (register.production_mutation_type !== 'approved_guarded_legacy_retirements') {
  fail('production mutation type must record the approved guarded retirements')
}

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

const retiredProgress = register.assets.find((asset) => asset.id === 'LD-001')
if (!retiredProgress || retiredProgress.disposition !== 'retired_verified' || retiredProgress.rows !== 0) {
  fail('legacy progress asset must be retired_verified with zero production rows')
}

const rec = register.assets.find((asset) => asset.id === 'LD-003')
if (!rec || rec.disposition !== 'retired_verified' || rec.rows !== 0) {
  fail('legacy recommendations must be retired_verified with zero production rows')
}
if (rec.blockers.length !== 0) {
  fail('legacy recommendation retirement must have no remaining blockers')
}
if (!Array.isArray(rec.production_migration_versions) ||
    !rec.production_migration_versions.includes('20260930175711') ||
    !rec.production_migration_versions.includes('20260930191704')) {
  fail('legacy recommendation retirement migration versions must remain recorded')
}
const rosterIds = ['LD-004', 'LD-005', 'LD-007']
for (const id of rosterIds) {
  const asset = register.assets.find((item) => item.id === id)
  if (!asset || asset.disposition !== 'retired_verified' || asset.rows !== 0) {
    fail(id + ' legacy roster shell must be retired_verified with zero production rows')
  }
  if (asset.blockers.length !== 0) {
    fail(id + ' legacy roster shell must have no remaining blockers')
  }
}

const rosterFacts = register.production_facts?.roster_shell_retirement
if (!rosterFacts ||
    rosterFacts.production_students_present !== false ||
    rosterFacts.production_student_present !== false ||
    rosterFacts.production_schools_present !== false ||
    rosterFacts.enrollments_preserved !== true ||
    rosterFacts.classes_preserved !== true) {
  fail('legacy roster retirement production facts must record retired shells and preserved classroom schema')
}

const rosterMigrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260930203051_retire_legacy_roster_shells.sql'
)
let rosterMigration
try {
  rosterMigration = fs.readFileSync(rosterMigrationPath, 'utf8')
} catch (error) {
  fail('legacy roster retirement migration missing: ' + error.message)
}
for (const statement of [
  'drop table public.students restrict',
  'drop table public.student restrict',
  'drop table public.schools restrict'
]) {
  if (!rosterMigration.includes(statement)) fail('legacy roster retirement migration missing: ' + statement)
}
if (rosterMigration.toLowerCase().includes('cascade')) {
  fail('legacy roster retirement migration must not use CASCADE')
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

const summaryViews = register.production_facts?.summary_views
if (summaryViews?.post_migration_dashboard_direct_rest_dependency !== false) {
  fail('post-migration dashboard summary-view dependency must be false')
}
if (summaryViews?.post_migration_anon_select_privilege !== false) {
  fail('post-migration anonymous summary-view access must be false')
}
if (summaryViews?.post_migration_authenticated_select_privilege !== false) {
  fail('post-migration authenticated summary-view access must be false')
}
if (summaryViews?.authenticated_canonical_server_boundary !== true) {
  fail('authenticated canonical progress boundary must be recorded')
}
if (summaryViews?.production_legacy_table_present !== false) {
  fail('production legacy progress table must be recorded absent')
}
if (summaryViews?.production_legacy_summary_views_present !== false) {
  fail('production legacy progress summary views must be recorded absent')
}
if (summaryViews?.canonical_attempts_present !== true || summaryViews?.canonical_attempt_answers_present !== true) {
  fail('canonical progress tables must remain present after retirement')
}

const enrollments = register.assets.find((asset) => asset.id === 'LD-006')
const classes = register.assets.find((asset) => asset.id === 'LD-008')
if (!enrollments || enrollments.disposition !== 'retain_active' || enrollments.active_dependency !== true) {
  fail('enrollments must remain an active classroom runtime asset')
}
if (!classes || classes.disposition !== 'retain_active' || classes.active_dependency !== true) {
  fail('classes must remain an active classroom runtime asset')
}

const classroomRuntime = register.production_facts?.classroom_runtime_dependency
if (!classroomRuntime ||
    classroomRuntime.torquemind_api_reads_classes !== true ||
    classroomRuntime.torquemind_api_writes_classes !== true ||
    classroomRuntime.torquemind_api_reads_enrollments !== true ||
    classroomRuntime.torquemind_api_writes_enrollments !== true) {
  fail('classroom runtime dependency must remain explicit')
}

const smokeRows = register.production_facts?.historical_smoke_class_rows
if (!smokeRows ||
    smokeRows.rows !== 2206 ||
    smokeRows.all_rows_match_smoke_test_name_pattern !== true ||
    smokeRows.classes_with_enrollments !== 0 ||
    smokeRows.classes_with_assignments !== 0 ||
    smokeRows.classes_with_scenario_assignments !== 0 ||
    smokeRows.current_ci_targets_approved_staging_project !== true) {
  fail('historical smoke-class cleanup evidence must remain explicit')
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
  ' assets reviewed; guarded legacy retirements applied and verified'
)

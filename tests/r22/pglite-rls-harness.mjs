#!/usr/bin/env node
/**
 * R22 - PostgreSQL row-level-security verification harness (PGlite).
 *
 * Purpose: exercise the repository's REAL RLS policies on a REAL PostgreSQL
 * engine, without Docker, credentials, or any change to host permissions.
 *
 * What is real (production code), not reimplemented here:
 *   - the migration SQL under supabase/migrations/
 *   - every CREATE POLICY / USING / WITH CHECK predicate
 *   - privilege checks (GRANT/REVOKE) and RLS enforcement by the engine
 *
 * What is shimmed (Supabase supplies these; PGlite does not):
 *   - roles            anon, authenticated, service_role (service_role -> BYPASSRLS)
 *   - schema auth      + auth.users table (42 migrations FK to it)
 *   - auth.uid()       = (request.jwt.claims ->> 'sub')::uuid
 *   - auth.jwt()       = request.jwt.claims::jsonb
 *   - default grants   Supabase grants ALL on new public tables to anon/authenticated
 *                      before the migration's own REVOKE can take effect
 *
 * What is NOT modelled (see docs/security/R22-PGLITE-RLS-EVIDENCE.md):
 *   - PostgREST, GoTrue, pooling, multiple concurrent sessions, extension set,
 *     storage/realtime schemas. Single connection, in-memory, no durability.
 *
 * Usage:
 *   node tests/r22/pglite-rls-harness.mjs
 *   node tests/r22/pglite-rls-harness.mjs --json /tmp/r22-evidence.json
 *   node tests/r22/pglite-rls-harness.mjs --matrix      # migration compatibility sweep
 *
 * Exit code 0 only when every assertion in the default suite passes.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations')

/** Migrations required for the RLS surface under test, in dependency order. */
const REQUIRED_MIGRATIONS = [
  '20260817012628_create_attempts.sql',
  '20260821040000_create_syllabus_and_scenario_catalog.sql',
  // R22 Phase 1: classroom ownership policies for classes and enrollments.
  // Both are required: the second migration drops and recreates the policies of the
  // first with `(select auth.uid())`, so applying only the first would test a policy
  // shape that is not effective in production.
  '20260924052734_restore_classroom_api_schema.sql',
  '20260924052757_optimize_classroom_api_rls.sql',
]

const PGLITE_CANDIDATES = [
  join(REPO_ROOT, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js'),
  '/tmp/r22-deps/node_modules/@electric-sql/pglite/dist/index.js',
]

async function loadPGlite() {
  for (const candidate of PGLITE_CANDIDATES) {
    try {
      const mod = await import(pathToFileURL(candidate).href)
      if (mod.PGlite) return { PGlite: mod.PGlite, from: candidate }
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'PGlite not found. Install it outside the repo, e.g.\n' +
      '  mkdir -p /tmp/r22-deps && cd /tmp/r22-deps && npm init -y && npm i @electric-sql/pglite\n' +
      'or add @electric-sql/pglite as a devDependency (a decision for maintainers).'
  )
}

// ---------------------------------------------------------------------------
// Supabase compatibility shim
// ---------------------------------------------------------------------------
const SHIM_SQL = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.uid() returns uuid language sql stable as $fn$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$fn$;

create function auth.jwt() returns jsonb language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth  to anon, authenticated, service_role;

-- Mirror Supabase's project defaults: new public tables are granted to the
-- API roles at creation time, so an explicit REVOKE in a migration still wins.
-- Supabase grants to postgres, anon, authenticated AND service_role.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

function firstLine(text) {
  return String(text || '').split('\n')[0].trim().slice(0, 220)
}

async function applyMigration(db, filename) {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
  try {
    await db.exec(sql)
    return { file: filename, ok: true }
  } catch (error) {
    return { file: filename, ok: false, error: firstLine(error.message || error) }
  }
}


// ---------------------------------------------------------------------------
// Fixtures: two "tenants" (owner-scoped), one inactive catalog row
// ---------------------------------------------------------------------------
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const SYLLABUS_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const SYLLABUS_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const MAP_A = 'cccccccc-1111-4111-8111-cccccccccccc'
const MAP_B = 'dddddddd-2222-4222-8222-dddddddddddd'

const SEED_SQL = `
insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
insert into public.syllabi (id, owner_id, title)
  values ('${SYLLABUS_A}', '${USER_A}', 'Institution A syllabus'),
         ('${SYLLABUS_B}', '${USER_B}', 'Institution B syllabus');
insert into public.scenario_catalog (scenario_id, title, active)
  values ('scenario-active', 'Active scenario', true),
         ('scenario-active-2', 'Second active scenario', true),
         ('scenario-inactive', 'Retired scenario', false);
insert into public.syllabus_scenarios (id, syllabus_id, scenario_id, position)
  values ('${MAP_A}', '${SYLLABUS_A}', 'scenario-active', 1),
         ('${MAP_B}', '${SYLLABUS_B}', 'scenario-active', 1);
`

const ROLES = new Set(['anon', 'authenticated', 'service_role'])

/** Run fn with SET ROLE + request.jwt.claims, restoring session state afterwards. */
async function asRole(db, role, sub, fn) {
  if (!ROLES.has(role)) throw new Error(`unknown role: ${role}`)
  const claims = JSON.stringify(sub ? { sub, role } : { role })
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
  await db.exec(`set role ${role}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claims', '', false)`)
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
const results = []

/**
 * Attribute each assertion to the table its SQL touches, so coverage is measured rather
 * than declared. Every assertion in this harness queries an explicit `public.<table>`;
 * anything without one stays unattributed and is never counted as table coverage.
 */
function tableOf(sql) {
  const match = /public\.([a-z_0-9]+)/i.exec(String(sql || ''))
  return match ? match[1] : null
}

function record(label, expected, actual, pass, table = null) {
  results.push({ label, expected, actual, pass, table })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`)
  if (!pass) console.log(`        expected: ${expected}\n        actual:   ${actual}`)
}

async function expectRows(db, role, sub, label, sql, expectedCount) {
  const tag = `${label} [${role}${sub ? ':' + sub.slice(0, 4) : ''}]`
  try {
    const out = await asRole(db, role, sub, () => db.query(sql))
    record(tag, `${expectedCount} row(s)`, `${out.rows.length} row(s)`, out.rows.length === expectedCount, tableOf(sql))
  } catch (error) {
    record(tag, `${expectedCount} row(s)`, `error: ${firstLine(error.message)}`, false, tableOf(sql))
  }
}

async function expectRejected(db, role, sub, label, sql, pattern) {
  const tag = `${label} [${role}]`
  try {
    await asRole(db, role, sub, () => db.query(sql))
    record(tag, 'rejected', 'succeeded', false, tableOf(sql))
  } catch (error) {
    const message = String(error.message || error)
    record(
      tag,
      `rejected${pattern ? ' ' + pattern : ''}`,
      firstLine(message),
      pattern ? pattern.test(message) : true,
      tableOf(sql)
    )
  }
}

async function expectAffected(db, role, sub, label, sql, expectedCount) {
  const tag = `${label} [${role}]`
  try {
    const out = await asRole(db, role, sub, () => db.query(sql))
    record(tag, `${expectedCount} row(s) affected`, `${out.rows.length} row(s) affected`, out.rows.length === expectedCount, tableOf(sql))
  } catch (error) {
    record(tag, `${expectedCount} row(s) affected`, `error: ${firstLine(error.message)}`, false, tableOf(sql))
  }
}

// ---------------------------------------------------------------------------
// Suite: repository RLS policies, exercised as the real API roles
// ---------------------------------------------------------------------------
async function runSuite(db) {
  console.log('\n=== R22: repository RLS policies (syllabi / syllabus_scenarios / scenario_catalog) ===')

  // Positive controls: an authorized owner MUST succeed, otherwise the denials
  // below would prove nothing (the R26 harness learned this the hard way).
  await expectRows(db, 'authenticated', USER_A, 'owner SELECTs own syllabus', 'select id from public.syllabi', 1)
  await expectAffected(
    db, 'authenticated', USER_A, 'owner INSERTs own syllabus',
    `insert into public.syllabi (id, owner_id, title)
       values (gen_random_uuid(), '${USER_A}', 'A new syllabus') returning id`, 1
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'owner UPDATEs own syllabus',
    `update public.syllabi set title = 'A renamed syllabus' where id = '${SYLLABUS_A}' returning id`, 1
  )
  await expectRows(
    db, 'authenticated', USER_A, 'owner SELECTs own scenario mapping',
    'select id from public.syllabus_scenarios', 1
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'owner INSERTs mapping onto own syllabus',
    `insert into public.syllabus_scenarios (id, syllabus_id, scenario_id, position)
       values (gen_random_uuid(), '${SYLLABUS_A}', 'scenario-active-2', 2) returning id`, 1
  )
  await expectRows(
    db, 'authenticated', USER_A, 'authenticated reads only ACTIVE catalog rows',
    'select scenario_id from public.scenario_catalog', 2
  )

  // Cross-tenant reads must reveal nothing.
  await expectRows(
    db, 'authenticated', USER_B, 'other tenant SELECTs syllabi (sees only own)',
    'select id from public.syllabi', 1
  )
  await expectRows(
    db, 'authenticated', USER_A, 'foreign syllabus invisible by direct id predicate',
    `select id from public.syllabi where id = '${SYLLABUS_B}'`, 0
  )
  await expectRows(
    db, 'authenticated', USER_A, 'inactive catalog row invisible',
    `select scenario_id from public.scenario_catalog where scenario_id = 'scenario-inactive'`, 0
  )

  // Cross-tenant writes must be refused.
  await expectRejected(
    db, 'authenticated', USER_A, 'INSERT syllabus owned by other tenant',
    `insert into public.syllabi (id, owner_id, title)
       values (gen_random_uuid(), '${USER_B}', 'spoofed owner')`,
    /row-level security/i
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'UPDATE other tenant syllabus',
    `update public.syllabi set title = 'hijacked' where id = '${SYLLABUS_B}' returning id`, 0
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'DELETE other tenant syllabus',
    `delete from public.syllabi where id = '${SYLLABUS_B}' returning id`, 0
  )
  await expectRejected(
    db, 'authenticated', USER_A, 'INSERT mapping onto other tenant syllabus',
    `insert into public.syllabus_scenarios (id, syllabus_id, scenario_id, position)
       values (gen_random_uuid(), '${SYLLABUS_B}', 'scenario-active', 9)`,
    /row-level security/i
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'UPDATE other tenant mapping',
    `update public.syllabus_scenarios set position = 7 where id = '${MAP_B}' returning id`, 0
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'DELETE other tenant mapping',
    `delete from public.syllabus_scenarios where id = '${MAP_B}' returning id`, 0
  )
}


// R22 Phase 1 classroom fixtures: two owners plus an enrolled student and an outsider.
const STUDENT = '33333333-3333-4333-8333-333333333333'
const OUTSIDER = '44444444-4444-4444-8444-444444444444'
const CLASS_A = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
const CLASS_B = 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb'
const CLASS_TMP = 'dddddddd-5555-4555-8555-dddddddddddd'
const ENROLLMENT_1 = 'cccccccc-4444-4444-8444-cccccccccccc'

const CLASSROOM_SEED_SQL = `
insert into auth.users (id) values ('${STUDENT}'), ('${OUTSIDER}');
insert into public.classes (id, owner_id, name, class_code) values
  ('${CLASS_A}', '${USER_A}', 'Class owned by A', 'ZZA-001'),
  ('${CLASS_B}', '${USER_B}', 'Class owned by B', 'ZZB-001'),
  ('${CLASS_TMP}', '${USER_A}', 'Class A deletes', 'ZZA-TMP');
insert into public.enrollments (id, class_id, user_id) values
  ('${ENROLLMENT_1}', '${CLASS_A}', '${STUDENT}');
`

// ---------------------------------------------------------------------------
// Suite: classroom ownership policies (classes, enrollments) - R22 Phase 1
// ---------------------------------------------------------------------------
/**
 * Effective policies under test (6; created by 20260924052734 and recreated by
 * 20260924052757 with `(select auth.uid())`):
 *   classes     : select / insert / update / delete scoped to owner_id = auth.uid()
 *   enrollments : select member-or-owner, insert self-or-owner
 *
 * `enrollments` grants SELECT and INSERT only, so UPDATE/DELETE denials there are
 * privilege denials and are asserted as such - never counted as RLS evidence.
 */
async function runClassroomSuite(db) {
  console.log('\n=== R22 Phase 1: classes and enrollments (owner/member policies) ===')

  const auditPrivilege = async (table, verb, expected) => {
    const value = (await db.query(`select has_table_privilege('authenticated', 'public.${table}', '${verb}') as v`)).rows[0].v
    record(
      `${table}: authenticated ${expected ? 'HOLDS' : 'LACKS'} ${verb}${expected ? '' : ' (denial is privilege, not RLS)'}`,
      String(expected),
      String(value),
      value === expected,
      table
    )
  }

  // --- classes: positive controls ---
  await expectRows(db, 'authenticated', USER_A, 'class owner SELECTs own classes', 'select id from public.classes', 2)
  await expectAffected(
    db, 'authenticated', USER_A, 'class owner INSERTs own class',
    `insert into public.classes (id, owner_id, name, class_code)
       values (gen_random_uuid(), '${USER_A}', 'A new class', 'ZZA-NEW') returning id`, 1
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'class owner UPDATEs own class',
    `update public.classes set name = 'Renamed by A' where id = '${CLASS_A}' returning id`, 1
  )

  // --- classes: cross-owner denials ---
  await expectRows(
    db, 'authenticated', OUTSIDER, 'unrelated user sees no classes',
    'select id from public.classes', 0
  )
  await expectRejected(
    db, 'authenticated', USER_A, 'INSERT class owned by another user',
    `insert into public.classes (id, owner_id, name, class_code)
       values (gen_random_uuid(), '${USER_B}', 'spoofed owner', 'ZZA-SPOOF')`,
    /row-level security/i
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'UPDATE another owner class',
    `update public.classes set name = 'hijacked' where id = '${CLASS_B}' returning id`, 0
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'DELETE own class',
    `delete from public.classes where id = '${CLASS_TMP}' returning id`, 1
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'DELETE another owner class',
    `delete from public.classes where id = '${CLASS_B}' returning id`, 0
  )

  // --- classes: privilege audit (all four verbs are granted) ---
  await auditPrivilege('classes', 'SELECT', true)
  await auditPrivilege('classes', 'INSERT', true)
  await auditPrivilege('classes', 'UPDATE', true)
  await auditPrivilege('classes', 'DELETE', true)

  // --- enrollments: both branches of member-or-owner ---
  await expectRows(
    db, 'authenticated', STUDENT, 'enrolled student SELECTs own enrollment',
    'select id from public.enrollments', 1
  )
  await expectRows(
    db, 'authenticated', USER_A, 'class owner SELECTs enrollments of own class',
    `select id from public.enrollments where class_id = '${CLASS_A}'`, 1
  )
  await expectRows(
    db, 'authenticated', OUTSIDER, 'unrelated user sees no enrollments',
    'select id from public.enrollments', 0
  )
  await expectAffected(
    db, 'authenticated', STUDENT, 'student INSERTs self-enrollment (self branch)',
    `insert into public.enrollments (id, class_id, user_id)
       values (gen_random_uuid(), '${CLASS_B}', '${STUDENT}') returning id`, 1
  )
  await expectRejected(
    db, 'authenticated', STUDENT, 'student INSERTs enrollment for another user',
    `insert into public.enrollments (id, class_id, user_id)
       values (gen_random_uuid(), '${CLASS_A}', '${OUTSIDER}')`,
    /row-level security/i
  )
  await expectAffected(
    db, 'authenticated', USER_A, 'class owner INSERTs enrollment (owner branch)',
    `insert into public.enrollments (id, class_id, user_id)
       values (gen_random_uuid(), '${CLASS_A}', '${OUTSIDER}') returning id`, 1
  )

  // --- enrollments: UPDATE/DELETE ---
  // The migration grants only SELECT/INSERT, but Supabase's default privileges grant ALL on
  // new public tables to anon/authenticated, so that grant is additive rather than
  // restrictive: the role still holds UPDATE/DELETE. Because there is no UPDATE/DELETE
  // policy on enrollments, those operations are RLS-denied (0 rows) rather than
  // privilege-denied. This is asserted explicitly so the classification cannot drift.
  await auditPrivilege('enrollments', 'SELECT', true)
  await auditPrivilege('enrollments', 'INSERT', true)
  await auditPrivilege('enrollments', 'UPDATE', true)
  await auditPrivilege('enrollments', 'DELETE', true)
  await expectAffected(
    db, 'authenticated', STUDENT, 'UPDATE enrollment is denied by RLS (no UPDATE policy)',
    `update public.enrollments set created_at = now() where id = '${ENROLLMENT_1}' returning id`, 0
  )
  await expectAffected(
    db, 'authenticated', STUDENT, 'DELETE enrollment is denied by RLS (no DELETE policy)',
    `delete from public.enrollments where id = '${ENROLLMENT_1}' returning id`, 0
  )

  // --- integrity: denied writes must not have changed row counts ---
  await db.exec('reset role')
  const classCount = await db.query('select count(*)::int as n from public.classes')
  record(
    'denied class writes left classes intact (3: A, B, new)',
    '3 rows',
    `${classCount.rows[0].n} rows`,
    classCount.rows[0].n === 3,
    'classes'
  )
  const enrollmentCount = await db.query('select count(*)::int as n from public.enrollments')
  record(
    'denied enrollment writes left enrollments intact (3: seed, self, owner)',
    '3 rows',
    `${enrollmentCount.rows[0].n} rows`,
    enrollmentCount.rows[0].n === 3,
    'enrollments'
  )
}

// ---------------------------------------------------------------------------
// Suite: role boundary, data integrity, and the service-role posture
// ---------------------------------------------------------------------------
async function runRoleBoundarySuite(db) {
  console.log('\n=== R22: role boundary (anon / service_role) and integrity ===')

  // Anonymous role: no policy targets anon, so nothing is visible or writable.
  await expectRows(db, 'anon', null, 'anon SELECTs syllabi', 'select id from public.syllabi', 0)
  await expectRejected(
    db, 'anon', null, 'anon INSERTs syllabus',
    `insert into public.syllabi (id, owner_id, title) values (gen_random_uuid(), '${USER_A}', 'anon write')`,
    /row-level security|permission denied/i
  )

  // Denied writes must not have mutated data.
  await db.exec('reset role')
  const syllabiCount = await db.query('select count(*)::int as n from public.syllabi')
  record('denied writes left syllabi intact', '3 rows', `${syllabiCount.rows[0].n} rows`, syllabiCount.rows[0].n === 3, 'syllabi')
  const mapCount = await db.query('select count(*)::int as n from public.syllabus_scenarios')
  record(
    'denied mapping writes left data intact',
    '3 rows',
    `${mapCount.rows[0].n} rows`,
    mapCount.rows[0].n === 3,
    'syllabus_scenarios'
  )

  // service_role bypasses RLS. This records the production posture R26 already
  // described: tenant scoping is enforced by route code, not by RLS, whenever the
  // service role is used.
  await expectRows(db, 'service_role', null, 'service_role sees ALL syllabi (BYPASSRLS)', 'select id from public.syllabi', 3)

  // public.attempts: RLS enabled, no policies, explicit REVOKE from API roles.
  await expectRejected(
    db, 'authenticated', USER_A, 'authenticated SELECT on attempts',
    'select id from public.attempts', /permission denied|row-level security/i
  )
  await expectRejected(
    db, 'anon', null, 'anon SELECT on attempts',
    'select id from public.attempts', /permission denied|row-level security/i
  )
  await expectRows(db, 'service_role', null, 'service_role SELECT on attempts', 'select id from public.attempts', 0)
  await expectAffected(
    db, 'service_role', null, 'service_role INSERT on attempts',
    `insert into public.attempts (id, scenario, delivery_mode)
       values (gen_random_uuid(), 'scenario-active', 'training') returning id`, 1
  )
}

// ---------------------------------------------------------------------------
// Privilege audit: prove denials are RLS-driven, not ordinary permission denial
// ---------------------------------------------------------------------------
/**
 * A denial is only RLS evidence if the role actually holds the privilege it was denied.
 * This audit is the distinction the review asked for:
 *   - `authenticated`/`anon` HOLD SELECT/INSERT/UPDATE/DELETE on syllabi, so every zero-row
 *     result and every WITH CHECK rejection above is policy enforcement;
 *   - `authenticated` does NOT hold SELECT on attempts, so that denial is a privilege
 *     denial and must never be counted as RLS evidence.
 */
async function runPrivilegeAudit(db) {
  console.log('\n=== R22: privilege audit (RLS denial vs ordinary permission denial) ===')

  const audit = async (label, sql, expected) => {
    const out = await db.query(sql)
    const value = out.rows[0].v
    record(label, String(expected), String(value), value === expected, tableOf(sql))
  }

  await audit(
    'authenticated HOLDS SELECT on syllabi (so cross-tenant reads are filtered by RLS)',
    `select has_table_privilege('authenticated', 'public.syllabi', 'SELECT') as v`,
    true
  )
  await audit(
    'authenticated HOLDS INSERT on syllabi (so INSERT rejection is WITH CHECK, not privilege)',
    `select has_table_privilege('authenticated', 'public.syllabi', 'INSERT') as v`,
    true
  )
  await audit(
    'authenticated HOLDS UPDATE on syllabi (so 0-row updates are RLS-filtered)',
    `select has_table_privilege('authenticated', 'public.syllabi', 'UPDATE') as v`,
    true
  )
  await audit(
    'authenticated HOLDS DELETE on syllabi (so 0-row deletes are RLS-filtered)',
    `select has_table_privilege('authenticated', 'public.syllabi', 'DELETE') as v`,
    true
  )
  await audit(
    'anon HOLDS SELECT on syllabi yet sees 0 rows (RLS default-deny, not privilege)',
    `select has_table_privilege('anon', 'public.syllabi', 'SELECT') as v`,
    true
  )
  await audit(
    'authenticated LACKS SELECT on attempts (that denial IS a privilege denial)',
    `select has_table_privilege('authenticated', 'public.attempts', 'SELECT') as v`,
    false
  )
  await audit(
    'service_role HOLDS SELECT on attempts (granted explicitly by the migration)',
    `select has_table_privilege('service_role', 'public.attempts', 'SELECT') as v`,
    true
  )
  await audit(
    'row level security is enabled on public.syllabi (policy enforcement active)',
    `select relrowsecurity as v from pg_class where oid = 'public.syllabi'::regclass`,
    true
  )
}

// ---------------------------------------------------------------------------
// Migration compatibility sweep (reporting only, never gates the suite)
// ---------------------------------------------------------------------------
async function runMatrix(PGlite, from) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  const db = new PGlite()
  await db.exec(SHIM_SQL)
  const applied = []
  for (const file of files) applied.push(await applyMigration(db, file))
  await db.close()

  const ok = applied.filter((a) => a.ok).length
  console.log(`PGlite (${from}) migration compatibility: ${ok}/${files.length} applied, ${files.length - ok} not applied`)
  for (const entry of applied) {
    if (!entry.ok) console.log(`  NOT APPLIED  ${entry.file}\n                 ${entry.error}`)
  }
  return { engine: 'pglite', pgliteFrom: from, total: files.length, applied: ok, failures: applied.filter((a) => !a.ok) }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2)
  const jsonIndex = argv.indexOf('--json')
  const jsonOut = jsonIndex >= 0 ? argv[jsonIndex + 1] : null
  const matrixMode = argv.includes('--matrix')

  const { PGlite, from } = await loadPGlite()
  console.log(`PGlite loaded from: ${from}`)

  if (matrixMode) {
    const matrix = await runMatrix(PGlite, from)
    if (jsonOut) writeFileSync(jsonOut, JSON.stringify(matrix, null, 2))
    process.exitCode = 0
    return
  }

  const db = new PGlite()
  const engine = (await db.query('select version()')).rows[0].version
  console.log(`engine: ${engine}`)

  await db.exec(SHIM_SQL)

  const applied = []
  for (const file of REQUIRED_MIGRATIONS) applied.push(await applyMigration(db, file))
  for (const entry of applied) {
    if (!entry.ok) {
      console.error(`MIGRATION FAILED: ${entry.file}: ${entry.error}`)
      process.exitCode = 3
      return
    }
  }
  console.log(`migrations applied: ${applied.map((a) => a.file).join(', ')}`)

  await db.exec(SEED_SQL)
  await db.exec(CLASSROOM_SEED_SQL)
  console.log('fixtures seeded: 4 owners/users, syllabi, catalog, classes (3), enrollments (1)')

  await runSuite(db)
  await runClassroomSuite(db)
  await runRoleBoundarySuite(db)
  await runPrivilegeAudit(db)

  const rlsEnabled = await db.query(
    `select c.relname, c.relrowsecurity, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      order by c.relname`
  )
  console.log('\n=== tables with RLS enabled (this cluster) ===')
  for (const row of rlsEnabled.rows) {
    console.log(`  ${row.relname}  rls=${row.relrowsecurity} force=${row.relforcerowsecurity}`)
  }

  await db.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`)
  if (failed.length) console.log(`FAILED: ${failed.map((f) => f.label).join('; ')}`)

  // Measured coverage: tables this run actually asserted against, with passing counts.
  // Declared coverage lives in tests/r22/rls-coverage.json and is checked by
  // scripts/verify-rls-policy-coverage.js, which never trusts the declaration alone.
  const tableCoverage = [...new Set(results.filter((r) => r.table).map((r) => r.table))]
    .sort()
    .map((table) => ({
      table,
      assertions: results.filter((r) => r.table === table).length,
      passed: results.filter((r) => r.table === table && r.pass).length,
    }))
  console.log('\n=== measured table coverage (this run) ===')
  for (const row of tableCoverage) console.log(`  ${row.table.padEnd(24)} ${row.passed}/${row.assertions} assertions passing`)

  if (jsonOut) {
    writeFileSync(
      jsonOut,
      JSON.stringify(
        {
          suite: 'R22 pglite rls',
          generatedAt: new Date().toISOString(),
          engine,
          pgliteFrom: from,
          migrations: applied,
          rlsEnabledTables: rlsEnabled.rows,
          results,
          tableCoverage,
          assertionTotal: results.length,
          assertionPassed: results.length - failed.length,
          passed: failed.length === 0,
        },
        null,
        2
      )
    )
    console.log(`evidence written: ${jsonOut}`)
  }

  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error('HARNESS ERROR:', error)
  process.exitCode = 2
})


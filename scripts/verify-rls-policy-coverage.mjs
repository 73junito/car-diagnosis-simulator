#!/usr/bin/env node
/**
 * R22 policy-coverage guard.
 *
 * Makes R22 coverage measurable and impossible to overstate. It never reports coverage
 * from a declaration alone:
 *
 *   1. derives the policy inventory from supabase/migrations case-insensitively
 *      (earlier case-sensitive greps undercounted 41 policies as 9);
 *   2. runs the PGlite harness and reads the assertions that actually executed and passed,
 *      attributed per table;
 *   3. compares inventory, measured evidence and the declared manifest
 *      (tests/r22/rls-coverage.json).
 *
 * A policy table is reported TESTED only when a real passing assertion exists for it.
 * Declared-but-unmeasured is an OVERSTATEMENT and fails. A policy table that is neither
 * tested nor scheduled is UNTRACKED and fails, so the inventory cannot grow silently.
 *
 * This is PGlite regression coverage on a real PostgreSQL engine, NOT Supabase/PostgREST
 * equivalence. R22 remains UNVERIFIED.
 *
 * Usage: node scripts/verify-rls-policy-coverage.mjs [--json <out>]
 * Exit:  0 consistent · 1 overstated/untracked/inconsistent · 3 harness failure
 */

import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const MANIFEST = join(ROOT, 'tests', 'r22', 'rls-coverage.json')
const HARNESS = join(ROOT, 'tests', 'r22', 'pglite-rls-harness.mjs')
const REPORT = join(tmpdir(), `r22-coverage-${process.pid}.json`)

function deriveInventory() {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  const sql = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n').toLowerCase()

  const policyCounts = new Map()
  const policyRe = /create policy\s+(?:"[^"]+"|[a-z0-9_]+)\s*(?:\r?\n\s*)?on\s+(?:public\.)?([a-z0-9_]+)/g
  for (const match of sql.matchAll(policyRe)) {
    policyCounts.set(match[1], (policyCounts.get(match[1]) || 0) + 1)
  }

  const rlsTables = new Set()
  const rlsRe = /alter table (?:if exists )?(?:only )?public\.([a-z0-9_]+)\s+enable row level security/g
  for (const match of sql.matchAll(rlsRe)) rlsTables.add(match[1])

  return { files: files.length, policyCounts, rlsTables }
}

function runHarness() {
  const run = spawnSync(process.execPath, [HARNESS, '--json', REPORT], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
  })
  if (run.status !== 0) {
    console.error('HARNESS FAILED — coverage cannot be assessed from a failing run.')
    console.error((run.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).join('\n'))
    console.error((run.stderr || '').trim().split('\n').slice(-3).join('\n'))
    process.exit(3)
  }
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  try {
    unlinkSync(REPORT)
  } catch {
    /* temp file cleanup is best-effort */
  }
  return report
}

/**
 * Pure classification of inventory + measured evidence + declared manifest.
 * Extracted so the negative cases can be asserted offline in CI (see --self-test):
 * declaring a table tested never substitutes for a passing assertion.
 */
function classify(inventory, measured, manifest) {
  const policyTables = [...inventory.policyCounts.keys()].sort()
  const totalPolicies = [...inventory.policyCounts.values()].reduce((a, b) => a + b, 0)

  const declaredTested = new Set(manifest.policyTablesTested || [])
  const planned = new Map()
  for (const phase of manifest.phases || []) {
    for (const table of phase.tables || []) planned.set(table, phase.phase)
  }

  const failures = []
  const tested = []
  const plannedOnly = []
  const untracked = []

  for (const table of policyTables) {
    const evidence = measured.get(table)
    const hasEvidence = Boolean(evidence && evidence.passed > 0)
    const isDeclared = declaredTested.has(table)

    if (isDeclared && !hasEvidence) {
      failures.push(`${table}: declared tested but no passing assertion was measured (overstatement)`)
      continue
    }
    if (hasEvidence && !isDeclared) {
      failures.push(`${table}: passing assertions exist but the manifest does not declare it tested`)
    }
    if (hasEvidence) {
      tested.push({ table, policies: inventory.policyCounts.get(table), ...evidence })
      continue
    }
    if (planned.has(table)) {
      plannedOnly.push({ table, policies: inventory.policyCounts.get(table), phase: planned.get(table) })
      continue
    }
    untracked.push({ table, policies: inventory.policyCounts.get(table) })
    failures.push(`${table}: policy-bearing table is neither tested nor scheduled (untracked)`)
  }

  for (const table of declaredTested) {
    if (!inventory.policyCounts.has(table)) {
      failures.push(`${table}: declared tested but carries no policies in the migrations (phantom declaration)`)
    }
  }
  for (const table of measured.keys()) {
    if (!inventory.policyCounts.has(table) && !inventory.rlsTables.has(table)) {
      failures.push(`${table}: assertions measured for a table that appears in no migration inventory`)
    }
  }
  for (const table of planned.keys()) {
    if (!inventory.policyCounts.has(table)) {
      failures.push(`${table}: scheduled in a phase but carries no policies`)
    }
  }

  const testedPolicies = tested.reduce((sum, t) => sum + t.policies, 0)
  const plannedPolicies = plannedOnly.reduce((sum, t) => sum + t.policies, 0)
  const coveredPct = totalPolicies ? Math.round((testedPolicies / totalPolicies) * 100) : 0

  return { policyTables, totalPolicies, tested, plannedOnly, untracked, failures, testedPolicies, plannedPolicies, coveredPct }
}

/**
 * Offline self-test: proves the classifier rejects false coverage claims, so CI records
 * the negative behaviour rather than a local anecdote. No database, no harness run.
 */
function runSelfTest() {
  const inventory = {
    files: 1,
    policyCounts: new Map([['alpha', 3], ['beta', 2], ['gamma', 1]]),
    rlsTables: new Set(['alpha', 'beta', 'gamma', 'deny_only']),
  }
  const measured = new Map([['alpha', { assertions: 5, passed: 5 }]])
  const cases = [
    ['truthful manifest is accepted', { policyTablesTested: ['alpha'], phases: [{ phase: 1, tables: ['beta', 'gamma'] }] }, []],
    ['declared without evidence is rejected', { policyTablesTested: ['alpha', 'beta'], phases: [{ phase: 1, tables: ['gamma'] }] }, ['overstatement']],
    ['omitted policy table is rejected', { policyTablesTested: ['alpha'], phases: [] }, ['untracked']],
    ['phantom declaration is rejected', { policyTablesTested: ['alpha', 'delta'], phases: [{ phase: 1, tables: ['beta', 'gamma'] }] }, ['phantom declaration']],
  ]

  let ok = true
  console.log('guard self-test (offline, synthetic manifest mutations)')
  for (const [label, manifest, expected] of cases) {
    const result = classify(inventory, measured, manifest)
    const pass =
      expected.length === 0
        ? result.failures.length === 0
        : expected.every((needle) => result.failures.some((failure) => failure.includes(needle)))
    ok = ok && pass
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`)
    if (!pass) console.log(`        failures: ${result.failures.join(' | ') || '(none)'}`)
  }
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — guard rejects false coverage claims in all ${cases.length} mutation cases`)
  process.exitCode = ok ? 0 : 1
}

function main() {
  if (process.argv.includes('--self-test')) return runSelfTest()

  const jsonIndex = process.argv.indexOf('--json')
  const jsonOut = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : null

  const inventory = deriveInventory()
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const report = runHarness()

  const measured = new Map()
  for (const row of report.tableCoverage || []) {
    measured.set(row.table, { assertions: row.assertions, passed: row.passed })
  }

  const { policyTables, totalPolicies, tested, plannedOnly, untracked, failures, testedPolicies, plannedPolicies, coveredPct } =
    classify(inventory, measured, manifest)

  console.log(`\npolicy inventory (case-insensitive, ${inventory.files} migrations)`)
  console.log(`  ${totalPolicies} policies across ${policyTables.length} tables`)
  console.log(`  ${inventory.rlsTables.size} tables have RLS enabled`)

  console.log(`\nTESTED — passing assertions measured in this run (${tested.length}/${policyTables.length} tables, ${testedPolicies}/${totalPolicies} policies, ${coveredPct}%)`)
  for (const t of tested) {
    console.log(`  ${t.table.padEnd(26)} ${String(t.policies).padStart(2)} policies  ${t.passed}/${t.assertions} assertions`)
  }

  console.log(`\nPLANNED — inventoried, no regression evidence yet (${plannedOnly.length} tables, ${plannedPolicies} policies)`)
  for (const t of plannedOnly.sort((a, b) => a.phase - b.phase || a.table.localeCompare(b.table))) {
    console.log(`  phase ${t.phase}  ${t.table.padEnd(30)} ${String(t.policies).padStart(2)} policies`)
  }

  if (manifest.denyAllExpected?.length) {
    console.log('\nDENY-ALL EXPECTED — RLS enabled, no policies, not policy-bearing')
    for (const table of manifest.denyAllExpected) {
      const enabled = inventory.rlsTables.has(table)
      if (!enabled) failures.push(`${table}: listed as deny-all but has no RLS enabled`)
      console.log(`  ${table.padEnd(30)} ${enabled ? 'RLS on, 0 policies' : 'NOT RLS-ENABLED (inspect)'}`)
    }
  }

  if (manifest.knownGaps?.noRls?.length) {
    console.log('\nKNOWN GAP — no RLS at all (border case, test explicitly)')
    for (const table of manifest.knownGaps.noRls) {
      if (inventory.rlsTables.has(table)) failures.push(`${table}: listed as having no RLS but RLS is enabled`)
      console.log(`  ${table}`)
    }
  }

  console.log(`\nmeasured assertions: ${report.assertionPassed}/${report.assertionTotal} passing`)

  if (failures.length) {
    console.log(`\nFAIL — ${failures.length} coverage consistency problem(s):`)
    for (const failure of failures) console.log(`  - ${failure}`)
  } else {
    console.log('\nPASS — declared coverage matches measured evidence; every policy table is tested or scheduled.')
  }

  if (jsonOut) {
    writeFileSync(
      jsonOut,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          migrations: inventory.files,
          totalPolicies,
          policyTables: policyTables.length,
          rlsEnabledTables: inventory.rlsTables.size,
          tested,
          planned: plannedOnly,
          untracked,
          failures,
          assertionTotal: report.assertionTotal,
          assertionPassed: report.assertionPassed,
          coveragePercent: coveredPct,
        },
        null,
        2
      )
    )
  }

  process.exitCode = failures.length === 0 ? 0 : 1
}

try {
  main()
} catch (error) {
  console.error('COVERAGE GUARD ERROR:', error && error.message)
  process.exitCode = 3
}


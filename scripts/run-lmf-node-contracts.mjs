#!/usr/bin/env node
/**
 * LMF contract runner — required CI entry point.
 *
 * Why this exists: `jest.config.js` excludes most `tests/lmf-*.test.js` files because they use
 * `node:test`, which Jest cannot execute. Those contracts therefore ran only in the LMF-specific
 * workflows, which are not required checks — and `tests/lmf-unified-runtime.test.js` ran nowhere
 * at all, so a regression there could not fail any build.
 *
 * This runner:
 *   1. discovers every `tests/lmf-*.test.js` / `*.spec.js` file;
 *   2. requires each one to be classified as `node-native` (run here) or `jest` (run by the
 *      required Jest jobs), so a new file cannot land unexecuted;
 *   3. runs the `node-native` set with `node --test`.
 *
 * Execution categories:
 *   node-native  import `node:test`, or are plain assertion scripts — both run under `node --test`
 *   jest         use Jest globals (`describe`/`it`), collected by jest.config.js `testMatch`
 *
 * It deliberately runs the suite even when discovery fails, so CI shows both signals, but the
 * exit code is then 2 rather than the test result: a misclassified or missing file is a coverage
 * defect in its own right and must fail the job whether or not the selected tests pass.
 *
 * This is LMF contract execution, not release evidence. The release-evidence HOLD is untouched:
 * `lmf-release-gates.test.js` and `lmf-robustness-catalog.test.js` run here to prove the gate
 * *refuses* incomplete evidence, which is the opposite of approving it.
 *
 * Usage:
 *   node scripts/run-lmf-node-contracts.mjs          # run the node-native set
 *   node scripts/run-lmf-node-contracts.mjs --list   # print the classification only
 *
 * Exit: 0 everything passed · 1 a contract failed · 2 discovery/classification problem
 */

import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const TESTS_DIR = join(ROOT, 'tests')
const FILE_PATTERN = /^lmf-[a-z0-9-]+\.(?:test|spec)\.js$/i
const CATEGORIES = new Set(['node-native', 'jest'])

/**
 * Every LMF test file must appear here exactly once. Adding a test file without classifying it
 * fails the run by design — that is the defect this runner exists to prevent.
 */
const CLASSIFICATION = {
  // node:test / plain assertion scripts — executed by `node --test` below.
  'lmf-evidence-migration.test.js': 'node-native',
  'lmf-evidence-store.test.js': 'node-native',
  'lmf-server-evidence.test.js': 'node-native',
  'lmf-supabase-auth.test.js': 'node-native',
  'lmf-reference-evidence-handler.test.js': 'node-native',
  'lmf-reference-evidence-bootstrap.test.js': 'node-native',
  'lmf-keyring.test.js': 'node-native',
  'lmf-writer-rotation.test.js': 'node-native',
  'lmf-retention-job.test.js': 'node-native',
  'lmf-solver-registry.test.js': 'node-native',
  'lmf-reference-models.test.js': 'node-native',
  'lmf-electrical-compatibility.test.js': 'node-native',
  // Previously orphaned: excluded from Jest and absent from every workflow list.
  'lmf-unified-runtime.test.js': 'node-native',
  // Release-gate contracts: execute here, but the HOLD they encode is unchanged.
  'lmf-release-gates.test.js': 'node-native',
  'lmf-robustness-catalog.test.js': 'node-native',

  // Jest suites — collected by jest.config.js testMatch in the required Jest jobs.
  'lmf-foundation.test.js': 'jest',
  'lmf-runtime-coverage.test.js': 'jest',
  'lmf-reference-bridge.spec.js': 'jest',
  'lmf-reference-evidence.spec.js': 'jest'
}
function discover() {
  return readdirSync(TESTS_DIR)
    .filter((file) => FILE_PATTERN.test(file))
    .sort()
}

/** Returns { present, nodeNative, problems }. Problems are coverage defects, not test results. */
function classify() {
  const present = discover()
  const problems = []
  const nodeNative = []

  for (const [file, category] of Object.entries(CLASSIFICATION)) {
    if (!CATEGORIES.has(category)) {
      problems.push(`${file}: invalid execution category "${category}" (expected node-native or jest)`)
      continue
    }
    if (!present.includes(file)) problems.push(`${file}: declared as ${category} but missing from tests/ (stale entry)`)
    if (category === 'node-native') nodeNative.push(file)
  }

  for (const file of present) {
    if (!Object.prototype.hasOwnProperty.call(CLASSIFICATION, file)) {
      problems.push(
        `${file}: unclassified LMF test file - add it to CLASSIFICATION as 'node-native' or 'jest' ` +
          'so it cannot land unexecuted'
      )
    }
  }

  if (nodeNative.length === 0) problems.push('no node-native LMF contracts selected')

  return { present, nodeNative: nodeNative.sort(), problems }
}

function printClassification({ present, nodeNative }) {
  const jestFiles = present.filter((file) => !nodeNative.includes(file))
  console.log(`LMF test files discovered: ${present.length}`)
  console.log(`  node-native (run here): ${nodeNative.length}`)
  for (const file of nodeNative) console.log(`    ${file}`)
  console.log(`  jest-visible (required Jest jobs): ${jestFiles.length}`)
  for (const file of jestFiles) console.log(`    ${file}`)
}


const { present, nodeNative, problems } = classify()
printClassification({ present, nodeNative })

const listOnly = process.argv.includes('--list')

if (problems.length) {
  console.error(`\nLMF DISCOVERY FAILURE — ${problems.length} classification problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
}

if (listOnly) {
  if (!problems.length) console.log('\nOK — every LMF test file is classified')
  else console.error('\nFAIL — discovery is inconsistent (classification only, nothing was run)')
  process.exit(problems.length ? 2 : 0)
}

console.log(`\nRunning ${nodeNative.length} node-native LMF contract file(s) via node --test\n`)
const run = spawnSync(process.execPath, ['--test', ...nodeNative.map((file) => join('tests', file))], {
  cwd: ROOT,
  stdio: 'inherit'
})

if (run.error) console.error(`LMF runner error: ${run.error.message}`)
if (run.status !== 0) console.error('\nFAIL — one or more LMF node-native contracts failed')

// Discovery problems win the exit code: an unclassified or missing file is a coverage defect
// regardless of whether the selected contracts passed, so it must never exit 0.
const exitCode = problems.length ? 2 : (run.status ?? 1)
if (problems.length) {
  console.error('\nFAIL — fix the discovery/classification problems above; the run executed tests anyway')
}
console.log(`\nLMF node-native contracts: ${exitCode === 0 ? 'PASS' : 'FAIL'} (exit ${exitCode})`)
process.exit(exitCode)


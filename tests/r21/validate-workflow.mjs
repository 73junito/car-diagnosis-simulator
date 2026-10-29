#!/usr/bin/env node
/**
 * R21 package validator - structural and safety checks on the draft workflow.
 *
 * Runs entirely offline: it never contacts staging and never executes the workflow.
 * js-yaml is resolved out-of-tree (/tmp/r21-deps) so no dependency file changes.
 *
 * Usage: node tests/r21/validate-workflow.mjs
 * Exit:  0 every check passed · 1 at least one check failed · 3 harness error
 */

import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'r21-jwt-negative-probes.yml')
const RUNNER = join(REPO_ROOT, 'tests', 'r21', 'jwt-negative-probes.mjs')

const require = createRequire(import.meta.url)
const yamlPath = require.resolve('js-yaml', { paths: ['/tmp/r21-deps/node_modules', join(REPO_ROOT, 'node_modules')] })
const yaml = await import(pathToFileURL(yamlPath).href)

const raw = readFileSync(WORKFLOW, 'utf8')
const doc = yaml.load(raw)
const runner = readFileSync(RUNNER, 'utf8')

const checks = []
const check = (label, pass, detail = '') => {
  checks.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
}

// --- trigger surface ------------------------------------------------------
const triggers = Object.keys(doc.on ?? {})
check('single trigger: workflow_dispatch', triggers.length === 1 && triggers[0] === 'workflow_dispatch', triggers.join(','))
check('no push/pull_request/schedule triggers', !/^\s{2}(push|pull_request|schedule):/m.test(raw))

// --- permission and credential surface -----------------------------------
const perms = doc.permissions ?? {}
check('permissions limited to contents: read', perms.contents === 'read' && Object.keys(perms).length === 1, JSON.stringify(perms))
check('no service-role / admin credential referenced', !/SERVICE_ROLE|STAGING_SECRET|service_role|TORQUEMIND_STAGING_CLI/.test(raw))
const ALLOWED_SECRETS = [
  'secrets.STAGING_URL',
  'secrets.STAGING_ANON',
  'secrets.R21_TEACHER_EMAIL',
  'secrets.R21_TEACHER_PASSWORD',
]
check('only allowlisted secrets referenced',
  (raw.match(/secrets\.([A-Z0-9_]+)/g) ?? []).every((m) => ALLOWED_SECRETS.includes(m)),
  (raw.match(/secrets\.([A-Z0-9_]+)/g) ?? []).join(','))

// --- runtime guards -------------------------------------------------------
const job = Object.values(doc.jobs ?? {})[0] ?? {}
check('job sets timeout-minutes', Number.isFinite(job['timeout-minutes']), String(job['timeout-minutes']))
check('job pins the staging environment', job.environment === 'jchfruprqpeypdttvlam_staging', String(job.environment))
check('concurrency group prevents overlapping runs', typeof doc.concurrency?.group === 'string', String(doc.concurrency?.group))

const steps = job.steps ?? []
const runText = steps.filter((s) => s.run).map((s) => s.run).join('\n')
check('explicit confirmation gate present', /probe-staging-readonly/.test(runText))
check('shell does not enable xtrace', !/set -[a-z]*x/.test(runText))
check('no secret interpolated directly into shell text', !/\$\{\{\s*secrets\./.test(runText))
check('secrets passed via env only', steps.filter((s) => s.env).every((s) => !JSON.stringify(s.env).includes('echo')))
check('no continue-on-error', !/continue-on-error/.test(raw))

// --- action pinning --------------------------------------------------------
const uses = [...raw.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1])
check('all actions pinned to a full SHA', uses.length > 0 && uses.every((u) => /@[a-f0-9]{40}$/.test(u)), uses.join(','))

// --- probe runner safety ---------------------------------------------------
const writeVerbs = [...runner.matchAll(/method:\s*'(POST|PUT|PATCH|DELETE)'/g)].map((m) => m[1])
check(
  'runner has exactly one non-GET call: the auth password grant',
  writeVerbs.length === 1 && writeVerbs[0] === 'POST' && /TOKEN_PATH = '\/auth\/v1\/token\?grant_type=password'/.test(runner),
  writeVerbs.join(',')
)
check('no application-data write verbs (PUT/PATCH/DELETE)', !/'(PUT|PATCH|DELETE)'/.test(runner))
check(
  'contemporaneous positive control implemented',
  /async function runPositiveControl/.test(runner) && /access_token/.test(runner)
)
check(
  'positive control fails closed without credentials',
  /R21_TEACHER_EMAIL \/ R21_TEACHER_PASSWORD are required/.test(runner)
)
// R21 must not borrow the shared account or another workflow's identity: the password
// grant creates a session, so a shared identity could disturb a sibling smoke run.
const runnerCode = runner
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/[ \t]\/\/.*$/gm, '')
check(
  'runner uses only the dedicated R21 identity in code',
  !/SMOKE_TEACHER_|API_SMOKE_TEACHER_|TEST_TEACHER_/.test(runnerCode) && /R21_TEACHER_EMAIL/.test(runnerCode)
)
check(
  'workflow references no shared or sibling-identity secrets',
  !/secrets\.(SMOKE_TEACHER|API_SMOKE_TEACHER|TEST_TEACHER)/.test(raw)
)
check(
  'expiry/audience probes carry explicit limitation caveats',
  (runner.match(/NOT demonstrated/g) ?? []).length >= 2
)
check('runner allowlists exactly one host', /ALLOWED_HOSTS = new Set\(\['([^']+)'\]\)/.test(runner))
check('allowlisted host is the staging project', /ALLOWED_HOSTS = new Set\(\['jchfruprqpeypdttvlam\.supabase\.co'\]\)/.test(runner))
check('runner enforces a request cap', /MAX_REQUESTS = (\d+)/.test(runner))
check('runner enforces a per-request timeout', /REQUEST_TIMEOUT_MS = ([\d_]+)/.test(runner))
check('runner refuses non-TLS targets', /refusing non-TLS target/.test(runner))
check('runner never prints response bodies', !/console\.(log|error)\([^)]*body/i.test(runner) && /body\)?\.cancel/.test(runner))
check(
  'runner never interpolates token material into output',
  !/console\.(log|error)\([^)]*\$\{[^}]*\bauth\b/i.test(runner) && !/console\.(log|error)\([^)]*\$\{[^}]*\.auth\b/i.test(runner)
)

const failed = checks.filter((c) => !c.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length) console.log(`FAILED: ${failed.map((f) => f.label).join('; ')}`)
process.exitCode = failed.length === 0 ? 0 : 1

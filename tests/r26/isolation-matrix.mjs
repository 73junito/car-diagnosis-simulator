/**
 * R26 isolation matrix — runtime authorization evidence.
 *
 * Runs the REAL route handlers (imported from the worktree under test) against a
 * local Supabase stub. Every authorization decision is made by production code:
 * token extraction, token verification, role resolution, membership checks and
 * ownership filters are not reimplemented here.
 *
 * Usage:
 *   node tests/r26/isolation-matrix.mjs --suite institution
 *   node tests/r26/isolation-matrix.mjs --suite readiness \
 *     --route /home/rod/r26-readiness/worker/routes/diagnostic-readiness.js
 *
 * Exit code 0 only when every scenario meets its expectation.
 */

import { startStub } from './postgrest-stub.mjs'
import { datasetFor, schema, tokens, SCHOOL_A, SCHOOL_B } from './fixtures.mjs'

const SERVICE_KEY = 'r26-test-service-role-placeholder-not-a-secret'

function makeContext({ method = 'GET', headers = {}, query = {}, env }) {
  const captured = { status: null, body: null }
  const context = {
    env,
    req: {
      method,
      header: (name) => headers[String(name).toLowerCase()] ?? null,
      query: (name) => (name in query ? query[name] : null)
    },
    json: (body, status) => {
      captured.status = status
      captured.body = body
      return captured
    }
  }
  return { context, captured }
}

export async function runScenario({ handler, scenario }) {
  const stub = await startStub({
    dataset: datasetFor(scenario.variant || 'current'),
    schema,
    tokens,
    variant: scenario.variant || 'current',
    failingTables: scenario.failingTables || []
  })

  const headers = {}
  if (scenario.token) headers.authorization = `Bearer ${scenario.token}`

  const { context } = makeContext({
    headers,
    query: scenario.query || {},
    env: { SUPABASE_URL: stub.url, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }
  })

  let outcome
  try {
    const result = await handler(context)
    outcome = result && typeof result === 'object' && 'status' in result
      ? result
      : { status: null, body: result }
  } catch (error) {
    outcome = { status: 'threw', body: { error: String(error && error.message) } }
  } finally {
    await stub.close()
  }

  const failures = []
  if (outcome.status !== scenario.expect.status) {
    failures.push(`expected status ${scenario.expect.status}, got ${outcome.status}`)
  }
  if (scenario.expect.check) {
    failures.push(...(scenario.expect.check(outcome.body || {}, stub) || []))
  }

  return {
    name: scenario.name,
    expected: scenario.expect.status,
    status: outcome.status,
    body: outcome.body,
    attemptsQueried: stub.queriesFor('attempts').length,
    restQueries: stub.log.filter((entry) => entry.path.startsWith('/rest/v1/')).length,
    failures,
    pass: failures.length === 0
  }
}

function summarise(label, results) {
  console.log(`\n=== ${label} ===`)
  for (const result of results) {
    console.log(
      `${result.pass ? 'PASS' : 'FAIL'}  ${String(result.expected).padEnd(4)} got ${String(result.status).padEnd(5)}  ${result.name}`
    )
    for (const failure of result.failures) console.log(`        ${failure}`)
  }
  const failed = results.filter((result) => !result.pass)
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`)
  return failed.length === 0
}

function reportClassIds(body) {
  return (Array.isArray(body.classSummaries) ? body.classSummaries : []).map((row) => row.classId)
}

function noFabricatedZero(body) {
  const text = JSON.stringify(body)
  const problems = []
  for (const key of ['attempts', 'completedAttempts', 'completionRate', 'averageScore']) {
    if (text.includes(`"${key}":0`)) problems.push(`fabricated zero for ${key}`)
  }
  return problems
}

function institutionScenarios() {
  return [
    {
      name: 'anonymous request (no token)',
      token: null,
      query: { schoolCode: SCHOOL_A },
      expect: { status: 401 }
    },
    {
      name: 'invalid token',
      token: 'token-not-a-real-session',
      query: { schoolCode: SCHOOL_A },
      expect: { status: 401 }
    },
    {
      name: 'authenticated student without institution role',
      token: 'token-student',
      query: { schoolCode: SCHOOL_A },
      expect: { status: 403 }
    },
    {
      name: 'instructor is not an institution administrator',
      token: 'token-instructor-a',
      query: { schoolCode: SCHOOL_A },
      expect: { status: 403 }
    },
    {
      name: 'cross-institution learner cannot read A',
      token: 'token-learner-both',
      query: { schoolCode: SCHOOL_A },
      expect: { status: 403 }
    },
    {
      name: 'inactive membership at A does not authorize A',
      token: 'token-admin-b',
      query: { schoolCode: SCHOOL_A },
      expect: { status: 403 }
    },
    {
      name: 'administrator A cannot read B',
      token: 'token-admin-a',
      query: { schoolCode: SCHOOL_B },
      expect: { status: 403 }
    },
    {
      name: 'administrator A reads A',
      token: 'token-admin-a',
      query: { schoolCode: SCHOOL_A },
      expect: {
        status: 200,
        check: (body, stub) => {
          const problems = []
          if (body.schoolCode !== SCHOOL_A) problems.push(`wrong schoolCode: ${body.schoolCode}`)
          if (body.activity !== null) problems.push(`activity must be null, got ${JSON.stringify(body.activity)}`)
          for (const summary of body.classSummaries || []) {
            if (summary.activity !== null) problems.push(`class ${summary.classId} activity must be null`)
          }
          const ids = reportClassIds(body)
          if (ids.includes('c-b1')) problems.push('institution B class leaked into A report')
          if (body.uniqueStudents !== 2) problems.push(`uniqueStudents expected 2, got ${body.uniqueStudents}`)
          problems.push(...noFabricatedZero(body))
          if (stub.queriesFor('attempts').length !== 0) problems.push('route issued an attempts query')
          return problems
        }
      }
    },
    {
      name: 'administrator B reads B',
      token: 'token-admin-b',
      query: { schoolCode: SCHOOL_B },
      expect: {
        status: 200,
        check: (body) => {
          const problems = []
          const ids = reportClassIds(body)
          if (ids.includes('c-a1') || ids.includes('c-a2')) {
            problems.push('institution A classes leaked into B report')
          }
          if (body.uniqueStudents !== 2) problems.push(`uniqueStudents expected 2, got ${body.uniqueStudents}`)
          if (body.activity !== null) problems.push('activity must be null')
          problems.push(...noFabricatedZero(body))
          return problems
        }
      }
    },
    {
      name: 'missing membership dependency fails closed',
      token: 'token-admin-a',
      query: { schoolCode: SCHOOL_A },
      failingTables: ['institution_memberships'],
      expect: {
        status: 500,
        check: (body) =>
          body && body.classSummaries ? ['returned class data despite dependency failure'] : []
      }
    }
  ]
}

export async function runInstitutionSuite(handler) {
  const results = []
  for (const scenario of institutionScenarios()) {
    results.push(await runScenario({ handler, scenario }))
  }
  return results
}

function readinessScenarios() {
  return [
    { name: 'anonymous request (no token)', token: null, expect: { status: 401 } },
    { name: 'invalid token', token: 'token-not-a-real-session', expect: { status: 401 } },
    { name: 'student token is not an instructor', token: 'token-student', expect: { status: 403 } },
    {
      name: 'current schema refuses attribution (503)',
      token: 'token-instructor-a',
      variant: 'current',
      expect: {
        status: 503,
        check: (body) =>
          body.reason === 'attempt_attribution_unavailable'
            ? []
            : [`expected attempt_attribution_unavailable, got ${body.reason}`]
      }
    },
    {
      name: 'instructor with no owned classes gets an empty authorized result',
      token: 'token-instructor-idle',
      variant: 'current',
      expect: {
        status: 200,
        check: (body) =>
          Array.isArray(body.rows) && body.rows.length === 0 ? [] : ['expected an empty rows array']
      }
    },
    {
      name: 'attributed schema scopes to owned classes only',
      token: 'token-instructor-a',
      variant: 'attributed',
      expect: {
        status: 200,
        check: (body) => {
          const problems = []
          const rows = Array.isArray(body.rows) ? body.rows : []
          const byCode = Object.fromEntries(rows.map((row) => [row.diagnostic_code, row]))
          if (rows.length !== 2) problems.push(`expected 2 diagnostic areas, got ${rows.length}`)
          if (!byCode.brakes) {
            problems.push('missing brakes area')
          } else if (byCode.brakes.attempts !== 1 || byCode.brakes.correct_attempts !== 1) {
            problems.push(`brakes expected 1/1, got ${byCode.brakes.attempts}/${byCode.brakes.correct_attempts}`)
          }
          if (!byCode.electrical) {
            problems.push('missing electrical area')
          } else if (byCode.electrical.attempts !== 1 || byCode.electrical.correct_attempts !== 0) {
            problems.push(`electrical expected 1/0, got ${byCode.electrical.attempts}/${byCode.electrical.correct_attempts}`)
          }
          if (body.scope.attemptsScoped !== 2) {
            problems.push(
              `expected 2 class-attributed attempts (foreign + null excluded), got ${body.scope.attemptsScoped}`
            )
          }
          if ((body.scope.classIds || []).includes('c-b1')) {
            problems.push('another institution class appears in scope')
          }
          const text = JSON.stringify(body)
          for (const leak of ['u-learner', 'att-', 'is_correct', 'question_text', 'student_answer']) {
            if (text.includes(leak)) problems.push(`payload exposes ${leak}`)
          }
          return problems
        }
      }
    },
    {
      name: 'instructor B sees only B classes',
      token: 'token-instructor-b',
      variant: 'attributed',
      expect: {
        status: 200,
        check: (body) => {
          const problems = []
          const ids = body.scope.classIds || []
          if (ids.length !== 1 || ids[0] !== 'c-b1') problems.push(`expected only c-b1, got ${ids.join(',')}`)
          if (body.scope.attemptsScoped !== 1) problems.push(`expected 1 attempt, got ${body.scope.attemptsScoped}`)
          const electrical = (body.rows || []).find((row) => row.diagnostic_code === 'electrical')
          if (!electrical || electrical.attempts !== 1 || electrical.correct_attempts !== 1) {
            problems.push('expected electrical 1/1 for institution B')
          }
          return problems
        }
      }
    },
    {
      name: 'missing taxonomy dependency fails closed',
      token: 'token-instructor-a',
      variant: 'attributed',
      failingTables: ['scenario_questions'],
      expect: {
        status: 503,
        check: (body) =>
          body.reason === 'question_taxonomy_unavailable'
            ? []
            : [`expected question_taxonomy_unavailable, got ${body.reason}`]
      }
    }
  ]
}

export async function runReadinessSuite(handler) {
  const results = []
  for (const scenario of readinessScenarios()) {
    results.push(await runScenario({ handler, scenario }))
  }
  return results
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

async function loadHandler(routePath, handlerName) {
  const { pathToFileURL } = await import('node:url')
  const module = await import(pathToFileURL(routePath).href)
  const handler = module[handlerName]
  if (typeof handler !== 'function') throw new Error(`${handlerName} is not exported by ${routePath}`)
  return handler
}

async function main() {
  const { fileURLToPath } = await import('node:url')
  const fs = await import('node:fs')
  const suite = arg('--suite') || 'all'
  const jsonOut = arg('--json')
  const evidence = { generatedAt: new Date().toISOString(), node: process.version, suites: {} }
  let allPassed = true

  if (suite === 'institution' || suite === 'all') {
    const routePath = fileURLToPath(new URL('../../worker/routes/institution-reporting.js', import.meta.url))
    const handler = await loadHandler(routePath, 'handleInstitutionAdminReport')
    const results = await runInstitutionSuite(handler)
    allPassed = summarise(`institution reporting — ${routePath}`, results) && allPassed
    evidence.suites.institutionReporting = results
  }

  if (suite === 'readiness' || suite === 'all') {
    const routePath = arg('--route')
    if (!routePath) {
      console.error(
        '\nBLOCKED: the readiness suite requires --route <path to diagnostic-readiness.js> in an isolated worktree.'
      )
      process.exitCode = 2
      return
    }
    const handler = await loadHandler(routePath, arg('--handler') || 'handleInstructorDiagnosticReadiness')
    const results = await runReadinessSuite(handler)
    allPassed = summarise(`diagnostic readiness — ${routePath}`, results) && allPassed
    evidence.suites.diagnosticReadiness = results
  }

  evidence.passed = allPassed
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(evidence, null, 2))
  process.exitCode = allPassed ? 0 : 1
}

main().catch((error) => {
  console.error('HARNESS ERROR:', error)
  process.exitCode = 3
})

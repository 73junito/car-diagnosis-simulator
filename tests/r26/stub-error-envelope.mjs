/**
 * Regression probe for the R26 PostgREST stub: error responses must carry a stable
 * envelope and never exception text, internal identifiers or stack frames.
 *
 * Guards the CodeQL "information exposure through a stack trace" finding on
 * tests/r26/postgrest-stub.mjs (taint from a caught exception into the HTTP response).
 */

import { startStub } from './postgrest-stub.mjs'
import { datasetFor, schema, tokens } from './fixtures.mjs'

const leaks = ['does not exist', 'unsupported operator', 'not_a_real_column', 'gt.5', ' at ', '/home/', '.mjs', 'stack']

function inspect(label, response, body, expectedCode, failures) {
  if (response.status !== 400) failures.push(`${label}: expected 400, got ${response.status}`)
  if (body.code !== expectedCode) failures.push(`${label}: expected code ${expectedCode}, got ${body.code}`)
  if (body.message !== 'query rejected') failures.push(`${label}: expected generic message, got ${JSON.stringify(body.message)}`)
  const text = JSON.stringify(body)
  for (const leak of leaks) {
    if (text.includes(leak)) failures.push(`${label}: response leaks ${JSON.stringify(leak)} -> ${text}`)
  }
  for (const field of ['details', 'hint', 'stack']) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      failures.push(`${label}: response exposes ${field}`)
    }
  }
}

const stub = await startStub({ dataset: datasetFor('current'), schema, tokens })
const failures = []

try {
  // Control: a valid query still works, so the probe is not passing trivially.
  const control = await fetch(`${stub.url}/rest/v1/classes?select=id`)
  const controlBody = await control.json()
  if (control.status !== 200 || !Array.isArray(controlBody) || controlBody.length !== 3) {
    failures.push(`control query failed: ${control.status} ${JSON.stringify(controlBody)}`)
  }

  // Unknown column -> columnError thrown inside the stub.
  const unknownColumn = await fetch(`${stub.url}/rest/v1/classes?select=id,not_a_real_column`)
  inspect('unknown column', unknownColumn, await unknownColumn.json(), '42703', failures)

  // Unsupported operator -> plain Error without a code.
  const badOperator = await fetch(`${stub.url}/rest/v1/classes?select=id&id=gt.5`)
  inspect('unsupported operator', badOperator, await badOperator.json(), 'XX000', failures)
} finally {
  await stub.close()
}

if (failures.length) {
  console.error('FAIL: stub error responses are not sanitized')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exitCode = 1
} else {
  console.log('PASS: stub error responses are generic and leak no exception detail')
}

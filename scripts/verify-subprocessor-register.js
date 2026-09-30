'use strict'

const fs = require('fs')
const path = require('path')

const registerPath = path.join(
  process.cwd(),
  'docs',
  'compliance',
  'subprocessor-register.json'
)

const allowedStatuses = new Set([
  'active_required',
  'active_conditional',
  'supported_not_approved',
  'non_student_only',
  'review_required'
])

function fail(message) {
  console.error(`[FAIL] Subprocessor register: ${message}`)
  process.exit(1)
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`)
  }
}

let register
try {
  register = JSON.parse(fs.readFileSync(registerPath, 'utf8'))
} catch (error) {
  fail(`invalid JSON: ${error.message}`)
}

if (register.version !== 1) fail('version must be 1')
requireString(register.verified_at, 'verified_at')
requireString(register.scope, 'scope')

if (!Array.isArray(register.processors) || register.processors.length === 0) {
  fail('processors must be a non-empty array')
}

const ids = new Set()
for (const processor of register.processors) {
  requireString(processor.id, 'processor.id')
  requireString(processor.provider, `${processor.id}.provider`)
  requireString(processor.approval, `${processor.id}.approval`)
  requireString(processor.contract_evidence, `${processor.id}.contract_evidence`)
  requireString(processor.retention, `${processor.id}.retention`)
  requireString(processor.training_use, `${processor.id}.training_use`)

  if (ids.has(processor.id)) fail(`duplicate processor id: ${processor.id}`)
  ids.add(processor.id)

  if (!Array.isArray(processor.status) || processor.status.length === 0) {
    fail(`${processor.id}.status must be a non-empty array`)
  }
  for (const status of processor.status) {
    if (!allowedStatuses.has(status)) {
      fail(`${processor.id} has unknown status: ${status}`)
    }
  }

  if (!Array.isArray(processor.service_role) || processor.service_role.length === 0) {
    fail(`${processor.id}.service_role must be a non-empty array`)
  }
  if (!Array.isArray(processor.student_data) || processor.student_data.length === 0) {
    fail(`${processor.id}.student_data must be a non-empty array`)
  }
  if (typeof processor.student_data_allowed !== 'boolean') {
    fail(`${processor.id}.student_data_allowed must be boolean`)
  }

  if (
    processor.student_data_allowed === true &&
    processor.status.some(status =>
      status === 'review_required' ||
      status === 'supported_not_approved' ||
      status === 'non_student_only'
    )
  ) {
    fail(`${processor.id} cannot allow student data while unapproved/review-required`)
  }
}

if (!Array.isArray(register.invariants) || register.invariants.length === 0) {
  fail('at least one invariant is required')
}

console.log(
  `[PASS] Subprocessor register: ${register.processors.length} entries, ${ids.size} unique IDs`
)

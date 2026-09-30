'use strict'

const fs = require('fs')
const path = require('path')

const contractPath = path.join(
  process.cwd(),
  'docs',
  'compliance',
  'retention-deletion-contract.json'
)

function fail(message) {
  console.error('[FAIL] Retention/deletion contract: ' + message)
  process.exit(1)
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(label + ' must be a non-empty string')
  }
}

let contract
try {
  contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
} catch (error) {
  fail('invalid JSON: ' + error.message)
}

if (contract.version !== 1) fail('version must be 1')
requireString(contract.verified_at, 'verified_at')
requireString(contract.change_type, 'change_type')

const targets = contract.operational_targets || {}
for (const key of [
  'direct_user_account_closure_days',
  'kansas_school_request_days',
  'coppa_parent_guardian_request_days'
]) {
  if (!Number.isInteger(targets[key]) || targets[key] <= 0) {
    fail('operational_targets.' + key + ' must be a positive integer')
  }
}

if (!Array.isArray(contract.retention_classes) || contract.retention_classes.length === 0) {
  fail('retention_classes must be a non-empty array')
}

const classIds = new Set()
for (const item of contract.retention_classes) {
  requireString(item.id, 'retention_class.id')
  requireString(item.name, item.id + '.name')
  requireString(item.rule, item.id + '.rule')
  if (classIds.has(item.id)) fail('duplicate retention class id: ' + item.id)
  classIds.add(item.id)
  if (!Array.isArray(item.delete_on) || item.delete_on.length === 0) {
    fail(item.id + '.delete_on must be a non-empty array')
  }
}

if (!Array.isArray(contract.asset_mapping) || contract.asset_mapping.length === 0) {
  fail('asset_mapping must be a non-empty array')
}

const assetIds = new Set()
for (const mapping of contract.asset_mapping) {
  requireString(mapping.asset_id, 'asset_mapping.asset_id')
  requireString(mapping.state, mapping.asset_id + '.state')
  if (assetIds.has(mapping.asset_id)) fail('duplicate asset mapping: ' + mapping.asset_id)
  assetIds.add(mapping.asset_id)
  if (!Array.isArray(mapping.classes) || mapping.classes.length === 0) {
    fail(mapping.asset_id + '.classes must be a non-empty array')
  }
  for (const id of mapping.classes) {
    if (!classIds.has(id)) fail(mapping.asset_id + ' references unknown retention class: ' + id)
  }
}

for (const key of ['deletion_lifecycle', 'implementation_gates', 'invariants']) {
  if (!Array.isArray(contract[key]) || contract[key].length === 0) {
    fail(key + ' must be a non-empty array')
  }
}

if (!contract.invariants.includes('thirty_day_target_is_operational_not_statutory')) {
  fail('contract must distinguish the 30-day operating target from statutory deadlines')
}

console.log(
  '[PASS] Retention/deletion contract: ' +
  contract.retention_classes.length +
  ' classes, ' +
  contract.asset_mapping.length +
  ' mapped assets'
)

'use strict'

const fs = require('fs')
const path = require('path')

const inventoryPath = path.join(
  process.cwd(),
  'docs',
  'compliance',
  'student-data-inventory.json'
)

const allowedClassifications = new Set([
  'authentication_secret',
  'student_restricted',
  'institution_record',
  'deidentified_aggregate',
  'public_content',
  'review_required'
])

function fail(message) {
  console.error(`[FAIL] Student data inventory: ${message}`)
  process.exit(1)
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`)
}

const raw = fs.readFileSync(inventoryPath, 'utf8')
let inventory
try {
  inventory = JSON.parse(raw)
} catch (error) {
  fail(`invalid JSON: ${error.message}`)
}

if (inventory.version !== 1) fail('version must be 1')
requireNonEmptyString(inventory.verified_at, 'verified_at')
requireNonEmptyString(inventory.scope, 'scope')

const assets = [
  ...(Array.isArray(inventory.assets) ? inventory.assets : []),
  ...(Array.isArray(inventory.legacy_review_assets) ? inventory.legacy_review_assets : [])
]

if (assets.length === 0) fail('at least one data asset is required')

const ids = new Set()
for (const asset of assets) {
  requireNonEmptyString(asset.id, 'asset.id')
  requireNonEmptyString(asset.system, `${asset.id}.system`)
  requireNonEmptyString(asset.status, `${asset.id}.status`)

  if (ids.has(asset.id)) fail(`duplicate asset id: ${asset.id}`)
  ids.add(asset.id)

  if (!Array.isArray(asset.classification) || asset.classification.length === 0) {
    fail(`${asset.id}.classification must be a non-empty array`)
  }

  for (const classification of asset.classification) {
    if (!allowedClassifications.has(classification)) {
      fail(`${asset.id} has unknown classification: ${classification}`)
    }
  }
}

for (const asset of inventory.assets || []) {
  if (!Object.prototype.hasOwnProperty.call(asset, 'retention') && asset.id !== 'SDI-006') {
    fail(`${asset.id} must declare retention status`)
  }
}

if (!Array.isArray(inventory.invariants) || inventory.invariants.length === 0) {
  fail('at least one governance invariant is required')
}

console.log(
  `[PASS] Student data inventory: ${inventory.assets.length} active/transient assets, ` +
  `${inventory.legacy_review_assets.length} legacy/review assets, ${ids.size} unique IDs`
)

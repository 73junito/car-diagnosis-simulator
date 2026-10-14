'use strict'

const fs = require('fs')
const path = require('path')
const { validateAll } = require('./verify-animation-manifests')

const root = path.resolve(__dirname, '..')
const contractPath = path.join(root, 'data', 'architecture', 'animation-presentation-contract.json')
const registryPath = path.join(root, 'data', 'architecture', 'student-lab-animation-source-of-truth.json')

function verifyAnimationContract() {
  const errors = []
  if (!fs.existsSync(contractPath)) errors.push('ANIM-2B presentation contract artifact is missing')
  if (!fs.existsSync(registryPath)) errors.push('student-lab animation source-of-truth registry is missing')
  if (errors.length) return errors

  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

  if (contract.phase !== 'ANIM-2B') errors.push('presentation contract phase must be ANIM-2B')
  if (contract.manifest_schema_version !== '1.1.0') errors.push('presentation contract must target manifest schema 1.1.0')
  if (contract.principles?.electrical_truth?.length < 20) errors.push('electrical-truth principle is missing')
  if (contract.principles?.presentation_truth?.length < 20) errors.push('presentation-truth principle is missing')
  if (contract.principles?.release_authority?.length < 20) errors.push('release-authority principle is missing')
  if (contract.presentation_modes?.animated?.motion_required !== true) errors.push('animated mode must require motion')
  if (contract.presentation_modes?.['static-3d']?.motion_required !== false) errors.push('static-3d mode must not require motion')
  if (contract.presentation_modes?.['static-2d']?.motion_required !== false) errors.push('static-2d mode must not require motion')

  for (const key of ['assessment_eligible', 'scored_assessment_approved', 'agent_may_approve', 'agent_may_release']) {
    if (contract.invariants?.[key] !== false) errors.push('ANIM-2B invariant must remain false: ' + key)
  }

  if (registry.source_of_truth?.presentation_contract !== 'data/architecture/animation-presentation-contract.json') {
    errors.push('source-of-truth registry must point to the ANIM-2B presentation contract')
  }
  if (registry.source_of_truth?.manifest_schema_target !== '1.1.0') {
    errors.push('source-of-truth registry must target manifest schema 1.1.0')
  }
  if (registry.source_of_truth?.presentation_validator !== 'scripts/verify-animation-presentation-contract.js') {
    errors.push('source-of-truth registry must identify the canonical presentation validator')
  }

  const manifestResult = validateAll({ rootDir: root })
  errors.push(...manifestResult.errors)
  return errors
}

if (require.main === module) {
  const errors = verifyAnimationContract()
  if (errors.length) {
    console.error('[FAIL] ANIM-2B animation contract verification failed')
    for (const error of errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] ANIM-2B animation contract is versioned, fail-closed, and backward-compatible with current manifests')
}

module.exports = { verifyAnimationContract }

'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const prepPath = path.join(root, 'data/evidence/review-queues/charging-system-assessment-eligibility-prep-20261003.json')
const draftsPath = path.join(root, 'data/evidence/review-queues/charging-system-formative-question-drafts-20261003.json')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function collectBooleanClaims(node, trail = 'root', out = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectBooleanClaims(item, `${trail}[${index}]`, out))
    return out
  }
  if (!node || typeof node !== 'object') return out

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'boolean') out.push({ trail: `${trail}.${key}`, key, value })
    collectBooleanClaims(value, `${trail}.${key}`, out)
  }
  return out
}

function verifyAssessmentBoundary(prep, drafts) {
  const errors = []
  const forbiddenTrueKeys = new Set([
    'assessment_eligible',
    'scored',
    'institutional_assessment_eligible',
    'high_stakes_eligible',
    'production_assessment_api_eligible',
    'assessment_release',
    'high_stakes_release',
    'production_release'
  ])

  if (prep.stage !== 'assessment-eligibility-review-prepared-no-eligibility-change') {
    errors.push('assessment prep stage must remain no-eligibility-change')
  }

  const prepClaims = collectBooleanClaims(prep)
  for (const claim of prepClaims) {
    if (forbiddenTrueKeys.has(claim.key) && claim.value === true) {
      errors.push(`forbidden assessment promotion: ${claim.trail}=true`)
    }
  }

  if (prep.summary?.assessment_eligible_count !== 0) errors.push('assessment_eligible_count must remain 0')
  if (prep.summary?.scored_count !== 0) errors.push('scored_count must remain 0')
  if (prep.summary?.institutional_assessment_eligible_count !== 0) errors.push('institutional assessment count must remain 0')
  if (prep.summary?.high_stakes_eligible_count !== 0) errors.push('high-stakes count must remain 0')
  if (prep.summary?.production_assessment_api_eligible_count !== 0) errors.push('production assessment API count must remain 0')
  if (prep.summary?.human_assessment_decisions_recorded !== 0) {
    errors.push('human assessment decisions must remain 0 until an explicit governed decision is recorded')
  }

  const purpose = String(drafts.purpose || '')
  if (!purpose.includes('without granting assessment eligibility')) {
    errors.push('formative draft package must explicitly deny assessment eligibility')
  }
  if (!String(drafts.stage || '').includes('pending-item-level-governance')) {
    errors.push('formative draft package must remain pending item-level governance')
  }

  const draftClaims = collectBooleanClaims(drafts)
  for (const claim of draftClaims) {
    if (forbiddenTrueKeys.has(claim.key) && claim.value === true) {
      errors.push(`formative draft promoted into assessment use: ${claim.trail}=true`)
    }
  }

  return { ok: errors.length === 0, errors }
}

function main() {
  const result = verifyAssessmentBoundary(readJson(prepPath), readJson(draftsPath))
  if (!result.ok) {
    console.error('[FAIL] Assessment governance boundary')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Assessment governance boundary: formative drafts remain unscored and assessment-ineligible')
}

if (require.main === module) main()

module.exports = { collectBooleanClaims, verifyAssessmentBoundary }

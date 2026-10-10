'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_DIR = path.join(ROOT, 'docs', 'institutional-readiness')
const README_PATH = path.join(PACKAGE_DIR, 'README.md')
const INDEX_PATH = path.join(PACKAGE_DIR, 'evidence-index.json')
const CHECKLIST_PATH = path.join(PACKAGE_DIR, 'reviewer-checklist.md')

const REQUIRED_EVIDENCE = [
  'docs/releases/production-release-baseline-2026-10-09.md',
  'docs/releases/phase7a-production-baseline-monitor.md',
  'docs/curriculum-reference-quality-audit-2026-10-09.md',
  'docs/curriculum-reference-quality-baseline-2026-10-10.md',
  'docs/compliance/education-privacy-ai-control-matrix.md',
  'docs/compliance/student-data-inventory.md',
  'docs/compliance/student-data-inventory.json',
  'docs/compliance/retention-deletion-contract.md',
  'public-site/privacy.html',
  'public-site/accessibility/index.html',
  'public-site/institutions/index.html',
  'public-site/research-sources/index.html'
]

const FORBIDDEN_APPROVAL_CLAIMS = [
  /accredited(?:\s+by)?/i,
  /kansas board of regents approved/i,
  /kbor approved/i,
  /fully institution-ready/i,
  /assessment (?:is )?authorized/i,
  /high-stakes assessment (?:is )?authorized/i,
  /approved to award academic credit/i
]

const REQUIRED_BOUNDARY_PHRASES = [
  'Assessment authorization: Not granted',
  '64/64 quantitative curriculum-reference coverage',
  '64 strong, 0 solid, 0 review, with direct-domain authority 64/64',
  'The package itself does not make those institutional decisions.'
]

function verify() {
  const errors = []

  for (const file of [README_PATH, INDEX_PATH, CHECKLIST_PATH]) {
    if (!fs.existsSync(file)) errors.push('missing package file: ' + path.relative(ROOT, file))
  }
  if (errors.length) return { ok: false, errors }

  const readme = fs.readFileSync(README_PATH, 'utf8')
  const checklist = fs.readFileSync(CHECKLIST_PATH, 'utf8')
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))

  for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
    if (!readme.includes(phrase)) errors.push('required readiness boundary missing from README: ' + phrase)
  }

  for (const claim of FORBIDDEN_APPROVAL_CLAIMS) {
    const sanitized = readme
      .replace(/not an accreditation claim/gi, '')
      .replace(/not granted/gi, '')
      .replace(/does not make those institutional decisions/gi, '')
      .replace(/must be supported by new evidence/gi, '')
    if (claim.test(sanitized)) errors.push('unsupported approval claim detected: ' + claim)
  }

  if (index.phase !== '7B' || index.package !== 'institutional-readiness') {
    errors.push('evidence index identity must remain Phase 7B institutional-readiness')
  }

  const posture = index.posture || {}
  const falseRequired = [
    'accreditation_claim',
    'kbor_approval_claim',
    'assessment_authorized',
    'high_stakes_authorized',
    'full_reference_quality_institution_ready'
  ]
  for (const key of falseRequired) {
    if (posture[key] !== false) errors.push('evidence posture must remain false: ' + key)
  }

  const indexedPaths = new Set((index.evidence || []).map((item) => item.path))
  for (const evidencePath of REQUIRED_EVIDENCE) {
    if (!fs.existsSync(path.join(ROOT, evidencePath))) errors.push('referenced evidence file missing: ' + evidencePath)
    if (!indexedPaths.has(evidencePath)) errors.push('required evidence not indexed: ' + evidencePath)
  }

  const quality = (index.evidence || []).find((item) => item.area === 'curriculum_reference_quality')
  if (!quality || quality.status !== 'verified_screen') {
    errors.push('curriculum reference-quality evidence must remain a verified deterministic screen')
  }
  if (!/64 strong, 0 solid, 0 review/i.test(quality.notes || '')) {
    errors.push('curriculum reference-quality evidence must preserve the 64 strong / 0 review result')
  }
  if (!/does not itself establish institutional approval/i.test(quality.notes || '')) {
    errors.push('curriculum reference-quality evidence must preserve the no-automatic-institutional-approval boundary')
  }

  if (!/Completing this checklist does not by itself create accreditation/i.test(checklist)) {
    errors.push('reviewer checklist must preserve the no-automatic-approval boundary')
  }

  return { ok: errors.length === 0, errors, index }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7B institutional readiness package')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }

  console.log(
    '[PASS] Institutional readiness package: Phase 7C quality screen verified; assessment authorization remains closed'
  )
}

if (require.main === module) main()

module.exports = {
  REQUIRED_EVIDENCE,
  REQUIRED_BOUNDARY_PHRASES,
  FORBIDDEN_APPROVAL_CLAIMS,
  verify
}

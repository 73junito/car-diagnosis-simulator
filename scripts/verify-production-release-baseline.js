'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(ROOT, 'data', 'release', 'production-release-baseline-2026-10-09.json')
const PACKAGE_PATH = path.join(ROOT, 'package.json')

const EXPECTED_SHA = '9715aa014df2861531866895e3d81ce73585b22e'
const REQUIRED_SCRIPTS = {
  'audit:curriculum-source-rights': 'node scripts/curriculum-source-rights-closure-audit.js',
  'validate:state-privacy-ai-overlays': 'node scripts/verify-state-privacy-ai-overlays.js',
  'validate:curriculum-reference-coverage-baseline': 'node scripts/verify-curriculum-reference-coverage-baseline.js',
  'validate:assessment-governance-boundary': 'node scripts/verify-assessment-governance-boundary.js',
  'validate:production-surfaces': 'node scripts/verify-production-surfaces.js',
  'validate:google-crawler-access': 'node scripts/verify-google-crawler-access.js',
  'validate:public-indexability': 'node scripts/verify-public-indexability.js'
}

function audit() {
  const errors = []
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'))

  if (baseline.certified_main_sha !== EXPECTED_SHA) {
    errors.push('certified_main_sha changed from the approved merged main SHA')
  }

  if (!/^[0-9a-f]{40}$/.test(baseline.certified_main_sha || '')) {
    errors.push('certified_main_sha must be a 40-character Git SHA')
  }

  if (baseline.curriculum?.lesson_plans_total !== 64 ||
      baseline.curriculum?.lesson_plans_with_reference_coverage !== 64 ||
      baseline.curriculum?.undergraduate?.total !== 43 ||
      baseline.curriculum?.undergraduate?.covered !== 43 ||
      baseline.curriculum?.graduate?.total !== 21 ||
      baseline.curriculum?.graduate?.covered !== 21) {
    errors.push('curriculum coverage baseline must remain 64/64 (43/43 undergraduate, 21/21 graduate)')
  }

  if (baseline.source_rights?.expected_source_count !== 38 ||
      baseline.source_rights?.unresolved_reuse_unverified !== 0 ||
      baseline.source_rights?.original_seven_unresolved !== 0) {
    errors.push('source-rights closure counts do not match the approved baseline')
  }

  const assessment = baseline.assessment_governance || {}
  for (const [key, value] of Object.entries(assessment)) {
    if (value !== false) errors.push(`assessment governance boundary regressed: ${key} must remain false`)
  }

  if (baseline.search_indexability?.canonical_url_count !== 7) {
    errors.push('public canonical sitemap inventory must remain 7 URLs')
  }

  if (baseline.search_indexability?.google_search_console_live_test !== 'green' ||
      baseline.search_indexability?.google_search_console_sitemap !== 'green') {
    errors.push('Google Search Console baseline must remain green')
  }

  if (baseline.search_indexability?.cloudflare_verified_bots_allowed !== true) {
    errors.push('Cloudflare verified-bot handling must remain enabled in the baseline')
  }

  const gateCommands = new Map((baseline.gates || []).map((gate) => [gate.id, gate.command]))
  const expectedGateCommands = [
    ['source-rights-closure', 'npm run audit:curriculum-source-rights'],
    ['state-privacy-ai-overlays', 'npm run validate:state-privacy-ai-overlays'],
    ['curriculum-reference-coverage', 'npm run validate:curriculum-reference-coverage-baseline'],
    ['assessment-governance-boundary', 'npm run validate:assessment-governance-boundary'],
    ['production-surfaces', 'npm run validate:production-surfaces'],
    ['google-crawler-access', 'npm run validate:google-crawler-access'],
    ['public-indexability', 'npm run validate:public-indexability']
  ]

  for (const [id, command] of expectedGateCommands) {
    if (gateCommands.get(id) !== command) {
      errors.push(`missing or changed release gate: ${id}`)
    }
  }

  for (const [name, command] of Object.entries(REQUIRED_SCRIPTS)) {
    if (pkg.scripts?.[name] !== command) {
      errors.push(`package script missing or changed: ${name}`)
    }
  }

  return { ok: errors.length === 0, errors, baseline }
}

function main() {
  const result = audit()
  if (!result.ok) {
    console.error('[FAIL] Production release baseline')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }

  console.log(
    '[PASS] Production release baseline: ' +
    result.baseline.certified_main_sha +
    '; 64/64 curriculum coverage; assessment boundary locked; Search Console green'
  )
}

if (require.main === module) main()

module.exports = { EXPECTED_SHA, REQUIRED_SCRIPTS, audit }

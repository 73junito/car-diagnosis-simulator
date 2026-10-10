'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const MANIFEST = path.join(ROOT, 'docs', 'institutional-submission', 'export-manifest.json')
const EXPORT_DOC = path.join(ROOT, 'docs', 'institutional-submission', 'EXPORT.md')

const EXPECTED = {
  phase: '7E',
  package: 'institutional-submission-export',
  source_main_sha: '051935051b072349c6284be422854f27ac62981a',
  evidence_baseline_sha: '53222a91ba3d82770b20f778c4e5a0134873eef1',
  page_count: 13,
  docx_sha256: 'ee93673e3b7e1236793618c437980d0ca57290d4de57f43f2c7874d622eb13fc',
  pdf_sha256: 'ae39c98cfdcd5cf81f3ee27b293128101eece0bb491c55ff5783a2173f30e34e'
}

function verify() {
  const errors = []
  if (!fs.existsSync(MANIFEST)) errors.push('missing export-manifest.json')
  if (!fs.existsSync(EXPORT_DOC)) errors.push('missing EXPORT.md')
  if (errors.length) return { ok:false, errors }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const doc = fs.readFileSync(EXPORT_DOC, 'utf8')

  for (const key of ['phase','package','source_main_sha','evidence_baseline_sha','page_count']) {
    if (manifest[key] !== EXPECTED[key]) errors.push(`${key} does not match Phase 7E delivery baseline`)
  }

  const byFormat = new Map((manifest.artifacts || []).map(a => [a.format, a]))
  if (byFormat.get('docx')?.sha256 !== EXPECTED.docx_sha256) errors.push('DOCX SHA-256 changed')
  if (byFormat.get('pdf')?.sha256 !== EXPECTED.pdf_sha256) errors.push('PDF SHA-256 changed')

  if (manifest.qa?.docx_render_pages_checked !== '13/13') errors.push('DOCX QA coverage must remain 13/13')
  if (manifest.qa?.pdf_render_pages_checked !== '13/13') errors.push('PDF QA coverage must remain 13/13')
  for (const key of ['blank_pages','clipped_text','overlapping_content','broken_tables']) {
    if (manifest.qa?.[key] !== false) errors.push(`QA defect flag must remain false: ${key}`)
  }

  const posture = manifest.submission_boundaries || {}
  for (const key of [
    'accreditation_claim','kbor_approval_claim','academic_credit_authority_claim',
    'institutional_adoption_claim','assessment_authorized','high_stakes_authorized',
    'accessibility_certification_claim'
  ]) {
    if (posture[key] !== false) errors.push(`submission boundary must remain false: ${key}`)
  }

  if (!doc.includes('Assessment authorization remains not granted.')) {
    errors.push('EXPORT.md must preserve assessment hold')
  }

  return { ok: errors.length === 0, errors }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7E institutional submission export')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7E institutional submission export: artifact integrity and 13-page QA baseline locked')
}

if (require.main === module) main()
module.exports = { EXPECTED, verify }

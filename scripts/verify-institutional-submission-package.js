'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SUBMISSION_DIR = path.join(ROOT, 'docs', 'institutional-submission')
const PACKET_PATH = path.join(SUBMISSION_DIR, 'AutoLearnPro-Institutional-Submission-Packet.md')
const COVER_PATH = path.join(SUBMISSION_DIR, 'Submission-Cover-Sheet.md')
const CURRICULUM_PATH = path.join(SUBMISSION_DIR, 'Curriculum-Program-Map.md')
const MANIFEST_PATH = path.join(SUBMISSION_DIR, 'submission-manifest.json')

const REQUIRED_FILES = [
  'docs/institutional-submission/Submission-Cover-Sheet.md',
  'docs/institutional-submission/AutoLearnPro-Institutional-Submission-Packet.md',
  'docs/institutional-submission/Curriculum-Program-Map.md',
  'docs/institutional-submission/submission-manifest.json',
  'docs/institutional-readiness/reviewer-checklist.md',
  'data/curriculum/program-architecture.json',
  'data/curriculum/academic-pathways.json',
  'data/curriculum/course-catalog.json',
  'data/curriculum/course-delivery-status.json',
  'docs/releases/production-release-baseline-2026-10-09.md',
  'docs/releases/phase7a-production-baseline-monitor.md',
  'docs/curriculum-reference-quality-baseline-2026-10-10.md',
  'docs/curriculum-course-delivery-baseline-2026-10-10.md',
  'docs/compliance/education-privacy-ai-control-matrix.md',
  'docs/compliance/student-data-inventory.md',
  'docs/compliance/student-data-inventory.json',
  'docs/compliance/retention-deletion-contract.md',
  'public-site/privacy.html',
  'public-site/accessibility/index.html',
  'public-site/institutions/index.html'
]

const REQUIRED_PACKET_PHRASES = [
  'Assessment authorization: Not granted',
  '64 strong / 0 solid / 0 review',
  'direct-domain authority: **64/64**',
  'it does not mean 64 fully built online courses, 64 completed syllabi, or 64 production-ready courses',
  'fifty-two catalog-aligned dedicated course pages: AUT-101, AUT-105, AUT-110, AUT-115, AUT-120, AUT-121, AUT-130, AUT-131, AUT-150, AUT-160, AUT-170, AUT-180, AUT-200, AUT-201, AUT-210, AUT-211, AUT-220, AUT-230, AUT-240, AUT-250, AUT-251, AUT-260, AUT-270, AUT-280, AUT-300, AUT-301, AUT-310, AUT-320, AUT-321, AUT-330, AUT-331, AUT-340, AUT-350, AUT-360, AUT-370, AUT-501, AUT-515, AUT-520, AUT-525, AUT-530, AUT-535, AUT-540, AUT-545, AUT-550, AUT-555, AUT-560, AUT-565, AUT-570, AUT-575, AUT-580, AUT-585, and AUT-590',
  'AUT-250 HEV formative-training package** at **/courses/aut-250/**',
  'The submission package itself does not make or pre-empt those decisions.'
]

function verify() {
  const errors = []

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      errors.push('missing submission/evidence file: ' + file)
    }
  }
  if (errors.length) return { ok: false, errors }

  const packet = fs.readFileSync(PACKET_PATH, 'utf8')
  const cover = fs.readFileSync(COVER_PATH, 'utf8')
  const curriculum = fs.readFileSync(CURRICULUM_PATH, 'utf8')
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

  for (const phrase of REQUIRED_PACKET_PHRASES) {
    if (!packet.includes(phrase)) errors.push('required packet boundary missing: ' + phrase)
  }

  if (!cover.includes('Assessment authorization: Not granted')) {
    errors.push('cover sheet must state assessment authorization is not granted')
  }

  if (!curriculum.includes('planning') || !curriculum.includes('not identical to either proposed credential structure')) {
    errors.push('curriculum map must preserve the planning-catalog distinction')
  }
  if (!curriculum.includes('catalog-aligned dedicated course pages: **52**') ||
      !curriculum.includes('current catalog-aligned course pages: **AUT-101, AUT-105, AUT-110, AUT-115, AUT-120, AUT-121, AUT-130, AUT-131, AUT-150, AUT-160, AUT-170, AUT-180, AUT-200, AUT-201, AUT-210, AUT-211, AUT-220, AUT-230, AUT-240, AUT-250, AUT-251, AUT-260, AUT-270, AUT-280, AUT-300, AUT-301, AUT-310, AUT-320, AUT-321, AUT-330, AUT-331, AUT-340, AUT-350, AUT-360, AUT-370, AUT-501, AUT-515, AUT-520, AUT-525, AUT-530, AUT-535, AUT-540, AUT-545, AUT-550, AUT-555, AUT-560, AUT-565, AUT-570, AUT-575, AUT-580, AUT-585, and AUT-590**') ||
      !curriculum.includes('existing HEV formative-training package page: **AUT-250**, crosswalked from catalog **AUT-330**')) {
    errors.push('curriculum map must preserve the current Phase 7F-V catalog-aligned delivery state')
  }

  if (manifest.phase !== '7D' || manifest.package !== 'institutional-submission') {
    errors.push('submission manifest identity must remain Phase 7D institutional-submission')
  }

  if (manifest.repository_baseline_sha !== '53222a91ba3d82770b20f778c4e5a0134873eef1') {
    errors.push('repository baseline SHA does not match the Phase 7C merged main baseline')
  }

  const posture = manifest.submission_posture || {}
  const mustRemainFalse = [
    'accreditation_claim',
    'kbor_approval_claim',
    'academic_credit_authority_claim',
    'institutional_adoption_claim',
    'assessment_authorized',
    'high_stakes_authorized',
    'accessibility_certification_claim',
    'full_course_delivery_coverage_claim'
  ]
  for (const key of mustRemainFalse) {
    if (posture[key] !== false) errors.push('submission posture must remain false: ' + key)
  }

  const metrics = manifest.verified_metrics || {}
  if (metrics.lesson_plans_total !== 64) errors.push('lesson_plans_total must remain 64')
  if (metrics.undergraduate_lesson_plans !== 43) errors.push('undergraduate_lesson_plans must remain 43')
  if (metrics.graduate_lesson_plans !== 21) errors.push('graduate_lesson_plans must remain 21')
  if (metrics.reference_coverage !== '64/64') errors.push('reference_coverage must remain 64/64')
  if (metrics.reference_quality?.strong !== 64 ||
      metrics.reference_quality?.solid !== 0 ||
      metrics.reference_quality?.review !== 0) {
    errors.push('reference quality must remain 64 strong / 0 solid / 0 review')
  }
  if (metrics.direct_domain_authority !== '64/64') errors.push('direct_domain_authority must remain 64/64')
  if (metrics.governed_reference_sources !== 38) errors.push('governed_reference_sources must remain 38')
  if (metrics.unresolved_source_rights !== 0) errors.push('unresolved_source_rights must remain 0')
  if (metrics.technical_source_age_reviews !== '5/5') errors.push('technical_source_age_reviews must remain 5/5')
  if (metrics.production_monitor_gates !== 9) errors.push('production_monitor_gates must remain 9')
  if (metrics.catalog_aligned_dedicated_course_pages !== 52) errors.push('catalog_aligned_dedicated_course_pages must remain 52')
  if (JSON.stringify(metrics.catalog_aligned_dedicated_course_page_ids) !== JSON.stringify(["aut-101","aut-105","aut-110","aut-115","aut-120","aut-121","aut-130","aut-131","aut-150","aut-160","aut-170","aut-180","aut-200","aut-201","aut-210","aut-211","aut-220","aut-230","aut-240","aut-250","aut-251","aut-260","aut-270","aut-280","aut-300","aut-301","aut-310","aut-320","aut-321","aut-330","aut-331","aut-340","aut-350","aut-360","aut-370","aut-501","aut-515","aut-520","aut-525","aut-530","aut-535","aut-540","aut-545","aut-550","aut-555","aut-560","aut-565","aut-570","aut-575","aut-580","aut-585","aut-590"])) {
    errors.push('catalog_aligned_dedicated_course_page_ids must remain Batches 001-007')
  }
  if (metrics.legacy_training_package_pages !== 1) errors.push('legacy_training_package_pages must remain 1')
  if (JSON.stringify(metrics.legacy_training_package_page_ids) !== JSON.stringify(['aut-250'])) {
    errors.push('legacy_training_package_page_ids must remain [aut-250]')
  }

  const programs = new Map((manifest.proposed_programs || []).map((p) => [p.id, p]))
  const aas = programs.get('undergraduate-automotive-technology-aas')
  const grad = programs.get('graduate-automotive-engineering-technology')
  if (!aas || aas.total_credits !== 68 || aas.cip_code !== '47.0604') {
    errors.push('A.A.S. proposal must remain 68 credits at CIP 47.0604')
  }
  if (!grad || grad.total_credits !== 30 || grad.cip_code !== '15.0803') {
    errors.push('graduate proposal must remain 30 credits at CIP 15.0803')
  }

  const indexed = new Set((manifest.evidence || []).map((item) => item.path))
  for (const file of REQUIRED_FILES.filter((f) => !f.startsWith('docs/institutional-submission/'))) {
    if (!indexed.has(file) && file !== 'docs/institutional-readiness/reviewer-checklist.md') {
      errors.push('required evidence not indexed in submission manifest: ' + file)
    }
  }

  return { ok: errors.length === 0, errors, manifest }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7D institutional submission package')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }

  console.log(
    '[PASS] Phase 7D institutional submission package: external packet complete; 64/64 evidence posture preserved; assessment authorization remains closed'
  )
}

if (require.main === module) main()

module.exports = {
  REQUIRED_FILES,
  REQUIRED_PACKET_PHRASES,
  verify
}

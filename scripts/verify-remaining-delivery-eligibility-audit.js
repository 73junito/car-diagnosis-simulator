'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const architecture = read('data/curriculum/program-architecture.json')
const delivery = read('data/curriculum/course-delivery-status.json')
const audit = read('data/curriculum/remaining-delivery-eligibility-audit.json')

const HUMAN_TERMS = /standing|verified industry employment|approved internship placement|program approval|advisor approval/i

function referencedCourses(text) {
  return [...String(text || '').matchAll(/AUT\s+(\d{3})/g)].map((m) => 'aut-' + m[1].toLowerCase())
}

function classify(course, mapping, built) {
  const dependencies = [...new Set(referencedCourses(course.prerequisites))]
  const unresolved = dependencies.filter((id) => !built.has(id))
  if (!mapping) return 'blocked-missing-canonical-mapping'
  if (unresolved.length) return 'blocked-prerequisite-chain'
  if (HUMAN_TERMS.test(course.prerequisites || '')) return 'blocked-human-institutional-verification'
  return 'ready-to-build-now'
}

function verify() {
  const errors = []
  const built = new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds || [])
  const mappings = new Map((architecture.catalogDevelopmentMappings || []).map((m) => [m.catalogCourseId, m]))
  const remaining = (catalog.courses || []).filter((course) => !built.has(course.id))
  const auditById = new Map((audit.records || []).map((record) => [record.courseId, record]))

  if (audit.phase !== '7F-L') errors.push('audit phase must remain 7F-L')
  if (audit.sourceDeliveryPhase !== '7F-N') errors.push('audit source delivery phase must remain 7F-N')
  if (remaining.length !== 40) errors.push('remaining catalog course count must be 40 after Batch 008')
  if ((audit.records || []).length !== 40) errors.push('audit must classify all 40 remaining catalog courses')
  if (audit.summary?.readyToBuildNow !== 2) errors.push('ready-to-build-now count must be 2 after Batch 008 AUT-120 delivery')
  if (audit.summary?.blockedMissingCanonicalMapping !== 13) errors.push('missing canonical mapping count must be 13 after AUT-120 resolution')
  if (audit.summary?.blockedPrerequisiteChain !== 24) errors.push('prerequisite-chain count must be 24 after Batch 008')
  if (audit.summary?.blockedHumanInstitutionalVerification !== 1) errors.push('human/institutional count must remain 1')
  if (audit.conclusion?.batch008Ready !== true) errors.push('historical Batch 008 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch008Candidates || []) !== JSON.stringify(['aut-120'])) errors.push('historical Batch 008 candidate list must remain [aut-120]')
  if (audit.conclusion?.batch009Ready !== true) errors.push('Batch 009 must be ready after AUT-120 delivery')
  if (JSON.stringify(audit.conclusion?.batch009Candidates || []) !== JSON.stringify(['aut-121','aut-170'])) errors.push('Batch 009 candidate list must be exactly [aut-121,aut-170]')

  const expectedCounts = {
    'ready-to-build-now': 0,
    'blocked-missing-canonical-mapping': 0,
    'blocked-prerequisite-chain': 0,
    'blocked-human-institutional-verification': 0
  }

  for (const course of remaining) {
    const mapping = mappings.get(course.id)
    const expected = classify(course, mapping, built)
    expectedCounts[expected] += 1
    const record = auditById.get(course.id)
    if (!record) { errors.push('missing audit record: ' + course.id); continue }
    if (record.classification !== expected) errors.push(`classification drift: ${course.id} expected ${expected}, got ${record.classification}`)
    if (record.canonicalMapping !== Boolean(mapping)) errors.push('canonical mapping flag drift: ' + course.id)
    if (mapping && record.lessonPlanId !== mapping.existingLessonPlanId) errors.push('lesson-plan mapping drift: ' + course.id)
    const expectedUnresolved = [...new Set(referencedCourses(course.prerequisites))].filter((id) => !built.has(id))
    if (JSON.stringify(record.unresolvedPrerequisiteCourseIds) !== JSON.stringify(expectedUnresolved)) errors.push('unresolved prerequisite drift: ' + course.id)
  }

  if (expectedCounts['blocked-missing-canonical-mapping'] !== 13 ||
      expectedCounts['blocked-prerequisite-chain'] !== 24 ||
      expectedCounts['blocked-human-institutional-verification'] !== 1 ||
      expectedCounts['ready-to-build-now'] !== 2) {
    errors.push('recomputed eligibility partition does not match locked Phase 7F-L counts')
  }

  const aut420 = auditById.get('aut-420')
  if (!aut420 || aut420.classification !== 'blocked-human-institutional-verification') errors.push('AUT-420 human/institutional hold must remain explicit')

  return { ok: errors.length === 0, errors, summary: audit.summary, conclusion: audit.conclusion }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-L remaining delivery eligibility audit')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-L re-audit after Phase 7F-N: 40 remaining = 2 ready (AUT-121/AUT-170), 13 mapping-blocked, 24 prerequisite-chain-blocked, 1 human/institutional hold')
}

if (require.main === module) main()
module.exports = { classify, referencedCourses, verify }

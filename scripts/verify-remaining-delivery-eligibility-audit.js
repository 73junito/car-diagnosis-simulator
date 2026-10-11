'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const architecture = read('data/curriculum/program-architecture.json')
const delivery = read('data/curriculum/course-delivery-status.json')
const audit = read('data/curriculum/remaining-delivery-eligibility-audit.json')

const HUMAN_TERMS = /standing|verified industry employment|approved internship placement|program approval|advisor approval|two advanced technology courses/i

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
  if (audit.sourceDeliveryPhase !== '7F-Z') errors.push('audit source delivery phase must remain 7F-Z')
  if (remaining.length !== 8) errors.push('remaining catalog course count must be 8 after Batch 018')
  if ((audit.records || []).length !== 8) errors.push('audit must classify all 8 remaining catalog courses')
  if (audit.summary?.readyToBuildNow !== 0) errors.push('ready-to-build-now count must be 0 after Batch 018 delivery')
  if (audit.summary?.blockedMissingCanonicalMapping !== 0) errors.push('missing canonical mapping count must be 0 after Phase 7F-X canonical resolution')
  if (audit.summary?.blockedPrerequisiteChain !== 2) errors.push('prerequisite-chain count must be 2 after Batch 017 delivery')
  if (audit.summary?.blockedHumanInstitutionalVerification !== 6) errors.push('human/institutional count must be 6 after Batch 017 delivery')
  if (audit.conclusion?.batch008Ready !== true) errors.push('historical Batch 008 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch008Candidates || []) !== JSON.stringify(['aut-120'])) errors.push('historical Batch 008 candidate list must remain [aut-120]')
  if (audit.conclusion?.batch009Ready !== true) errors.push('historical Batch 009 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch009Candidates || []) !== JSON.stringify(['aut-121','aut-170'])) errors.push('historical Batch 009 candidate list must remain [aut-121,aut-170]')
  if (audit.conclusion?.batch010Ready !== true) errors.push('historical Batch 010 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch010Candidates || []) !== JSON.stringify(['aut-230','aut-240'])) errors.push('historical Batch 010 candidate list must remain [aut-230,aut-240]')
  if (audit.conclusion?.batch011Ready !== true) errors.push('historical Batch 011 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch011Candidates || []) !== JSON.stringify(['aut-150','aut-210','aut-525'])) errors.push('historical Batch 011 candidate list must remain [aut-150,aut-210,aut-525]')
  if (audit.conclusion?.batch012Ready !== true) errors.push('historical Batch 012 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch012Candidates || []) !== JSON.stringify(['aut-211','aut-250','aut-260','aut-270'])) errors.push('historical Batch 012 candidate list must remain [aut-211,aut-250,aut-260,aut-270]')
  if (audit.conclusion?.batch013Ready !== true) errors.push('historical Batch 013 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch013Candidates || []) !== JSON.stringify(['aut-251','aut-280'])) errors.push('historical Batch 013 candidate list must remain [aut-251,aut-280]')
  if (audit.conclusion?.batch014Ready !== true) errors.push('historical Batch 014 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch014Candidates || []) !== JSON.stringify(['aut-300','aut-310','aut-320','aut-330'])) errors.push('historical Batch 014 candidate list must remain [aut-300,aut-310,aut-320,aut-330]')
  if (audit.conclusion?.batch015Ready !== true) errors.push('historical Batch 015 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch015Candidates || []) !== JSON.stringify(['aut-301','aut-321','aut-331','aut-340','aut-350','aut-360','aut-370'])) errors.push('historical Batch 015 candidate list must remain [aut-301,aut-321,aut-331,aut-340,aut-350,aut-360,aut-370]')
  if (audit.conclusion?.batch016Ready !== true) errors.push('historical Batch 016 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch016Candidates || []) !== JSON.stringify(['aut-380','aut-390','aut-410'])) errors.push('historical Batch 016 candidate list must remain [aut-380,aut-390,aut-410]')
  if (audit.conclusion?.batch017Ready !== true) errors.push('historical Batch 017 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch017Candidates || []) !== JSON.stringify(['aut-140','aut-510','aut-600'])) errors.push('historical Batch 017 candidate list must remain [aut-140,aut-510,aut-600]')
  if (audit.conclusion?.batch018Ready !== true) errors.push('historical Batch 018 readiness must remain recorded')
  if (JSON.stringify(audit.conclusion?.batch018Candidates || []) !== JSON.stringify(['aut-610','aut-650'])) errors.push('historical Batch 018 candidate list must remain [aut-610,aut-650]')
  if (audit.conclusion?.batch019Ready !== false) errors.push('Batch 019 must remain blocked after Batch 018 delivery')
  if (JSON.stringify(audit.conclusion?.batch019Candidates || []) !== JSON.stringify([])) errors.push('Batch 019 candidate list must be empty')

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

  if (expectedCounts['blocked-missing-canonical-mapping'] !== 0 ||
      expectedCounts['blocked-prerequisite-chain'] !== 2 ||
      expectedCounts['blocked-human-institutional-verification'] !== 6 ||
      expectedCounts['ready-to-build-now'] !== 0) {
    errors.push('recomputed eligibility partition does not match locked Phase 7F-L counts')
  }

  const aut400 = auditById.get('aut-400')
  if (!aut400 || aut400.classification !== 'blocked-human-institutional-verification') errors.push('AUT-400 junior-standing hold must remain explicit')
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
  console.log('[PASS] Phase 7F-L re-audit after Phase 7F-Z: 8 remaining = 0 ready, 0 mapping-blocked, 2 prerequisite-chain-blocked, 6 human/institutional holds')
}

if (require.main === module) main()
module.exports = { classify, referencedCourses, verify }

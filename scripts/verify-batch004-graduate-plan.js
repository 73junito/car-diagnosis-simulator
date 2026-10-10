'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const architecture = read('data/curriculum/program-architecture.json')
const lessons = read('data/curriculum/lesson-plans.json')
const delivery = read('data/curriculum/course-delivery-status.json')
const blockers = read('data/curriculum/course-mapping-blocker-audit.json')
const plan = read('data/curriculum/course-delivery-batch004-plan.json')

const EXPECTED = ['aut-501', 'aut-515', 'aut-590']

function verify() {
  const errors = []
  const catalogById = new Map((catalog.courses || []).map((c) => [c.id, c]))
  const lessonById = new Map((lessons.lessonPlans || []).map((l) => [l.id, l]))
  const mappingById = new Map((architecture.catalogDevelopmentMappings || []).map((m) => [m.catalogCourseId, m]))
  const built = new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds || [])

  if (plan.phase !== '7F-H') errors.push('Batch 004 execution phase must remain 7F-H')
  if (plan.status !== 'page-built-verified') errors.push('Batch 004 must be page-built-verified in Phase 7F-H')
  if (plan.sourceDeliveryPhase !== '7F-H') errors.push('Batch 004 execution must match Phase 7F-H delivery state')

  const ids = (plan.courses || []).map((c) => c.courseId)
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED)) {
    errors.push(`Batch 004 must remain ${EXPECTED.join(', ')}`)
  }

  for (const planned of plan.courses || []) {
    const course = catalogById.get(planned.courseId)
    const mapping = mappingById.get(planned.courseId)
    if (!course) {
      errors.push(`catalog course missing: ${planned.courseId}`)
      continue
    }
    if (course.academicLevel !== 'graduate' || planned.academicLevel !== 'graduate') {
      errors.push(`Batch 004 course must remain graduate: ${planned.courseId}`)
    }
    if (!mapping || mapping.mappingType !== 'canonical-catalog-course') {
      errors.push(`canonical mapping missing: ${planned.courseId}`)
      continue
    }
    if (mapping.catalogCourseId !== mapping.existingCourseId) {
      errors.push(`canonical identity invariant violated: ${planned.courseId}`)
    }
    if (mapping.existingLessonPlanId !== planned.lessonPlanId) {
      errors.push(`lesson mapping drift: ${planned.courseId}`)
    }
    const lesson = lessonById.get(planned.lessonPlanId)
    if (!lesson || lesson.courseId !== planned.courseId || lesson.academicLevel !== 'graduate') {
      errors.push(`graduate lesson mismatch: ${planned.courseId}`)
    }
    if (course.prerequisites !== planned.prerequisitesText) {
      errors.push(`prerequisite text drift: ${planned.courseId}`)
    }
    if (!planned.prerequisiteType || !planned.prerequisiteDisposition) {
      errors.push(`institutional prerequisite classification missing: ${planned.courseId}`)
    }
    if (planned.prerequisiteDisposition !== 'requires-human-or-institutional-verification') {
      errors.push(`Batch 004 prerequisite must require human/institutional verification: ${planned.courseId}`)
    }
    if (!built.has(planned.courseId)) {
      errors.push(`Batch 004 course missing from built delivery status: ${planned.courseId}`)
    }
    if (!fs.existsSync(path.join(ROOT, planned.targetPage))) {
      errors.push(`Batch 004 verified target page is missing: ${planned.targetPage}`)
    }
    if (planned.deliveryStatus !== 'page-built') {
      errors.push(`Batch 004 deliveryStatus must be page-built: ${planned.courseId}`)
    }
  }

  const deferred = (plan.deferredUndergraduate || []).find((x) => x.courseId === 'aut-420')
  if (!deferred) errors.push('AUT-420 must remain explicitly deferred')
  if (catalogById.get('aut-420')?.prerequisites !== 'Verified industry employment or approved internship placement required') {
    errors.push('AUT-420 employment-or-placement prerequisite text drift')
  }

  const priorityBlockers = new Set((blockers.priorityBlockers || []).map((b) => b.courseId))
  if (!priorityBlockers.has('aut-150')) errors.push('continuing priority blocker missing: aut-150')
  if (mappingById.has('aut-150')) errors.push('aut-150 must remain blocked until a later recorded canonical resolution')
  const aut120Resolution = (blockers.resolvedSinceAudit || []).find((item) => item.courseId === 'aut-120' && item.resolutionPhase === '7F-M')
  if (!aut120Resolution) errors.push('AUT-120 later Phase 7F-M resolution record missing')
  if (!mappingById.has('aut-120')) errors.push('AUT-120 canonical mapping expected after Phase 7F-M')

  const boundaries = plan.boundaries || {}
  if (boundaries.coursesBuiltByThisPhase !== 3) errors.push('Phase 7F-H must record 3 built Batch 004 courses')
  for (const key of ['academicStatusChanges','assessmentEligibilityChanges','productionReadyClaims']) {
    if (boundaries[key] !== 0) errors.push(`governance boundary must remain zero: ${key}`)
  }
  if (boundaries.assessmentAuthorization !== false) errors.push('assessmentAuthorization must remain false')
  if (boundaries.admissionsEligibilityAutomation !== false) errors.push('admissionsEligibilityAutomation must remain false')

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      batch4: ids,
      deferredUndergraduate: ['aut-420'],
      continuingBlockers: ['aut-150']
    }
  }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-H Batch 004 graduate foundation execution')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-H historical Batch 004 remains verified; aut-420 deferred; later AUT-120 Phase 7F-M resolution accepted; AUT-150 remains blocked')
}

if (require.main === module) main()
module.exports = { EXPECTED, verify }

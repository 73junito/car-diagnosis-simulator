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

  if (plan.phase !== '7F-G') errors.push('Batch 004 plan phase must remain 7F-G')
  if (plan.status !== 'planned-for-delivery-build') errors.push('Batch 004 must remain planning-only before pages are built')
  if (plan.sourceDeliveryPhase !== '7F-F') errors.push('Batch 004 must derive from Phase 7F-F delivery state')

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
    if (built.has(planned.courseId)) {
      errors.push(`Batch 004 course already appears in built delivery status while plan is planning-only: ${planned.courseId}`)
    }
    if (fs.existsSync(path.join(ROOT, planned.targetPage))) {
      errors.push(`Batch 004 target page already exists while plan is planning-only: ${planned.targetPage}`)
    }
  }

  const deferred = (plan.deferredUndergraduate || []).find((x) => x.courseId === 'aut-420')
  if (!deferred) errors.push('AUT-420 must remain explicitly deferred')
  if (catalogById.get('aut-420')?.prerequisites !== 'Senior standing and department approval') {
    errors.push('AUT-420 institutional prerequisite text drift')
  }

  const priorityBlockers = new Set((blockers.priorityBlockers || []).map((b) => b.courseId))
  for (const id of ['aut-120', 'aut-150']) {
    if (!priorityBlockers.has(id)) errors.push(`continuing priority blocker missing: ${id}`)
    if (mappingById.has(id)) errors.push(`blocked course must not gain canonical mapping in Phase 7F-G: ${id}`)
  }

  const boundaries = plan.boundaries || {}
  for (const key of ['coursesBuiltByThisPhase','academicStatusChanges','assessmentEligibilityChanges','productionReadyClaims']) {
    if (boundaries[key] !== 0) errors.push(`planning boundary must remain zero: ${key}`)
  }
  if (boundaries.assessmentAuthorization !== false) errors.push('assessmentAuthorization must remain false')
  if (boundaries.admissionsEligibilityAutomation !== false) errors.push('admissionsEligibilityAutomation must remain false')

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      batch4: ids,
      deferredUndergraduate: ['aut-420'],
      continuingBlockers: ['aut-120','aut-150']
    }
  }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-G Batch 004 graduate foundation plan')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-G: Batch 004 aut-501/aut-515/aut-590 is canonically mapped and preserves institutional prerequisite verification; aut-420 deferred; aut-120/aut-150 remain blocked')
}

if (require.main === module) main()
module.exports = { EXPECTED, verify }

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PLAN_PATH = path.join(ROOT, 'data', 'curriculum', 'course-delivery-rollout-plan.json')
const BASELINE_PATH = path.join(ROOT, 'data', 'curriculum', 'course-delivery-status.json')
const CATALOG_PATH = path.join(ROOT, 'data', 'curriculum', 'course-catalog.json')
const LESSONS_PATH = path.join(ROOT, 'data', 'curriculum', 'lesson-plans.json')
const ARCH_PATH = path.join(ROOT, 'data', 'curriculum', 'program-architecture.json')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function catalogPrerequisiteIds(course) {
  const text = String(course.prerequisites || '')
  if (/^none$/i.test(text.trim())) return []
  return [...text.matchAll(/AUT\s+(\d{3})/gi)]
    .map((match) => `aut-${match[1]}`)
}

function verify() {
  const errors = []
  const plan = readJson(PLAN_PATH)
  const baseline = readJson(BASELINE_PATH)
  const catalog = readJson(CATALOG_PATH)
  const lessons = readJson(LESSONS_PATH)
  const architecture = readJson(ARCH_PATH)

  if (plan.phase !== '7F-D') errors.push('rollout execution phase must remain 7F-D')
  if (plan.purpose !== 'course-delivery-rollout-execution') {
    errors.push('plan purpose must remain course-delivery-rollout-execution')
  }

  const baselineState = baseline.baseline || {}
  const sourceBaseline = plan.sourceBaseline || {}
  if (sourceBaseline.phase !== '7F-D') errors.push('rollout execution must match Phase 7F-D delivery status')
  if (sourceBaseline.dedicatedCoursePageCount !== baselineState.dedicatedCoursePageCount) {
    errors.push('source dedicated course page count does not match current Phase 7F-D status')
  }
  if (JSON.stringify(sourceBaseline.dedicatedCoursePageIds) !== JSON.stringify(baselineState.dedicatedCoursePageIds)) {
    errors.push('source dedicated course page IDs do not match current Phase 7F-C status')
  }
  if (sourceBaseline.catalogCourseCount !== baselineState.catalogCourseCount) {
    errors.push('source catalog count does not match current delivery status')
  }
  if (sourceBaseline.lessonPlanCount !== baselineState.lessonPlanCount) {
    errors.push('source lesson-plan count does not match current delivery status')
  }

  const catalogById = new Map((catalog.courses || []).map((course) => [course.id, course]))
  const lessonById = new Map((lessons.lessonPlans || []).map((lesson) => [lesson.id, lesson]))
  const mappings = new Map(
    (architecture.catalogDevelopmentMappings || []).map((mapping) => [mapping.catalogCourseId, mapping])
  )

  const batches = [...(plan.batches || [])].sort((a, b) => a.sequence - b.sequence)
  const batch1 = batches.find((batch) => batch.id === 'batch-001-foundations')
  const batch2 = batches.find((batch) => batch.id === 'batch-002-foundation-extension')
  if (!batch1) {
    errors.push('Batch 001 foundations is missing')
  } else {
    const ids = batch1.courses.map((course) => course.courseId)
    const expected = ['aut-101', 'aut-105', 'aut-110', 'aut-115']
    if (JSON.stringify(ids) !== JSON.stringify(expected)) {
      errors.push(`Batch 001 course order must remain ${expected.join(', ')}`)
    }
    if (batch1.status !== 'page-built-verified') {
      errors.push('Batch 001 must remain page-built-verified')
    }
  }
  if (!batch2) {
    errors.push('Batch 002 foundation extension is missing')
  } else {
    const ids = batch2.courses.map((course) => course.courseId)
    const expected = ['aut-130', 'aut-131', 'aut-160', 'aut-180']
    if (JSON.stringify(ids) !== JSON.stringify(expected)) {
      errors.push(`Batch 002 course order must remain ${expected.join(', ')}`)
    }
    if (batch2.status !== 'page-built-verified') {
      errors.push('Batch 002 must be page-built-verified in Phase 7F-D')
    }
  }

  const completedPrior = new Set(baselineState.dedicatedCoursePageIds || [])
  for (const batch of batches) {
    const sameBatch = new Set(batch.courses.map((course) => course.courseId))
    for (const planned of batch.courses) {
      const catalogCourse = catalogById.get(planned.courseId)
      if (!catalogCourse) {
        errors.push(`planned rollout course missing from catalog: ${planned.courseId}`)
        continue
      }

      const mapping = mappings.get(planned.courseId)
      if (!mapping) {
        errors.push(`planned rollout course missing canonical development mapping: ${planned.courseId}`)
      } else {
        if (mapping.mappingType !== 'canonical-catalog-course') {
          errors.push(`planned rollout mapping must be canonical-catalog-course: ${planned.courseId}`)
        }
        if (mapping.existingLessonPlanId !== planned.lessonPlanId) {
          errors.push(`planned lesson mapping drift for ${planned.courseId}`)
        }
      }

      if (!lessonById.has(planned.lessonPlanId)) {
        errors.push(`planned rollout lesson plan missing: ${planned.lessonPlanId}`)
      }

      const catalogPrereqs = catalogPrerequisiteIds(catalogCourse)
      const plannedPrereqs = [...(planned.prerequisites || [])].sort()
      if (JSON.stringify(catalogPrereqs.sort()) !== JSON.stringify(plannedPrereqs)) {
        errors.push(`prerequisite drift for ${planned.courseId}: catalog=${catalogPrereqs.join(',')} plan=${plannedPrereqs.join(',')}`)
      }

      for (const prerequisite of plannedPrereqs) {
        if (!completedPrior.has(prerequisite) && !sameBatch.has(prerequisite)) {
          errors.push(`prerequisite for ${planned.courseId} is not satisfied by a prior or same rollout batch: ${prerequisite}`)
        }
      }

      if (batch.status === 'page-built-verified') {
        if (!planned.targetPage || !fs.existsSync(path.join(ROOT, planned.targetPage))) {
          errors.push(`verified rollout page is missing: ${planned.targetPage || planned.courseId}`)
        }
        if (planned.deliveryStatus !== 'page-built') {
          errors.push(`verified rollout deliveryStatus must be page-built: ${planned.courseId}`)
        }
      }
    }
    for (const course of batch.courses) completedPrior.add(course.courseId)
  }

  const blockerById = new Map((plan.blockers || []).map((blocker) => [blocker.courseId, blocker]))
  for (const id of ['aut-120', 'aut-150']) {
    if (!blockerById.has(id)) errors.push(`required mapping blocker missing from rollout plan: ${id}`)
    if (mappings.has(id)) errors.push(`course marked as mapping blocker now has a canonical development mapping: ${id}`)
  }

  const policy = plan.policy || {}
  for (const key of [
    'academicStatusIndependentFromDelivery',
    'planningDoesNotChangeAcademicStatus',
    'pageExistenceDoesNotImplyProductionReady',
    'assessmentAuthorizationRemainsClosed',
    'requireCanonicalCatalogLessonMappingForPlannedBuild',
    'requirePrerequisitesSatisfiedByPriorOrSameBatch'
  ]) {
    if (policy[key] !== true) errors.push(`rollout policy must remain true: ${key}`)
  }

  const boundaries = plan.boundaries || {}
  if (boundaries.coursesBuiltByThisPhase !== 4) errors.push('coursesBuiltByThisPhase must be 4 in Phase 7F-C')
  for (const key of ['academicStatusChanges', 'assessmentEligibilityChanges', 'productionReadyClaims']) {
    if (boundaries[key] !== 0) errors.push(`governance boundary must remain zero: ${key}`)
  }
  for (const key of ['assessmentAuthorization', 'scoringAuthorization', 'gradingAuthorization', 'highStakesAuthorization']) {
    if (boundaries[key] !== false) errors.push(`authorization boundary must remain false: ${key}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      batch1: batch1 ? batch1.courses.map((course) => course.courseId) : [],
      batchCount: batches.length,
      blockers: [...blockerById.keys()].sort()
    }
  }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-D course delivery rollout execution')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log(
    '[PASS] Phase 7F-D rollout execution: Batch 001 and Batch 002 pages are built and verified; aut-120/aut-150 remain blocked for canonical development mapping'
  )
}

if (require.main === module) main()

module.exports = { catalogPrerequisiteIds, verify }

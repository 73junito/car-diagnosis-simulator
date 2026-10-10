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

  if (plan.phase !== '7F-B') errors.push('plan phase must remain 7F-B')
  if (plan.purpose !== 'course-delivery-rollout-plan') {
    errors.push('plan purpose must remain course-delivery-rollout-plan')
  }

  const baselineState = baseline.baseline || {}
  const sourceBaseline = plan.sourceBaseline || {}
  if (sourceBaseline.phase !== '7F-A') errors.push('rollout plan must derive from Phase 7F-A')
  if (sourceBaseline.dedicatedCoursePageCount !== baselineState.dedicatedCoursePageCount) {
    errors.push('source dedicated course page count does not match Phase 7F-A baseline')
  }
  if (JSON.stringify(sourceBaseline.dedicatedCoursePageIds) !== JSON.stringify(baselineState.dedicatedCoursePageIds)) {
    errors.push('source dedicated course page IDs do not match Phase 7F-A baseline')
  }
  if (sourceBaseline.catalogCourseCount !== baselineState.catalogCourseCount) {
    errors.push('source catalog count does not match Phase 7F-A baseline')
  }
  if (sourceBaseline.lessonPlanCount !== baselineState.lessonPlanCount) {
    errors.push('source lesson-plan count does not match Phase 7F-A baseline')
  }

  const catalogById = new Map((catalog.courses || []).map((course) => [course.id, course]))
  const lessonById = new Map((lessons.lessonPlans || []).map((lesson) => [lesson.id, lesson]))
  const mappings = new Map(
    (architecture.catalogDevelopmentMappings || []).map((mapping) => [mapping.catalogCourseId, mapping])
  )

  const batches = [...(plan.batches || [])].sort((a, b) => a.sequence - b.sequence)
  const batch1 = batches.find((batch) => batch.id === 'batch-001-foundations')
  if (!batch1) {
    errors.push('Batch 001 foundations is missing')
  } else {
    const ids = batch1.courses.map((course) => course.courseId)
    const expected = ['aut-101', 'aut-105', 'aut-110', 'aut-115']
    if (JSON.stringify(ids) !== JSON.stringify(expected)) {
      errors.push(`Batch 001 course order must remain ${expected.join(', ')}`)
    }
    if (batch1.status !== 'planned-for-delivery-build') {
      errors.push('Batch 001 must remain planned-for-delivery-build until pages are actually built')
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

      if (planned.targetPage && fs.existsSync(path.join(ROOT, planned.targetPage))) {
        errors.push(`planned build target already exists but plan still claims planning-only: ${planned.targetPage}`)
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
  for (const key of ['coursesBuiltByThisPhase', 'academicStatusChanges', 'assessmentEligibilityChanges', 'productionReadyClaims']) {
    if (boundaries[key] !== 0) errors.push(`planning-only boundary must remain zero: ${key}`)
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
    console.error('[FAIL] Phase 7F-B course delivery rollout plan')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log(
    '[PASS] Phase 7F-B rollout plan: Batch 001 aut-101/aut-105/aut-110/aut-115 is canonically mapped and prerequisite-contained; aut-120/aut-150 remain blocked for mapping'
  )
}

if (require.main === module) main()

module.exports = { catalogPrerequisiteIds, verify }

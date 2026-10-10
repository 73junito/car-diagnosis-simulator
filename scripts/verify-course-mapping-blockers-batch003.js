'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const architecture = read('data/curriculum/program-architecture.json')
const delivery = read('data/curriculum/course-delivery-status.json')
const blockerAudit = read('data/curriculum/course-mapping-blocker-audit.json')
const batch3Plan = read('data/curriculum/course-delivery-batch003-plan.json')
const lessons = read('data/curriculum/lesson-plans.json')

function parsePrereqIds(text) {
  if (!text || /^none$/i.test(String(text).trim())) return []
  return [...String(text).matchAll(/AUT\s+(\d{3})/gi)].map((m) => `aut-${m[1]}`)
}

function verify() {
  const errors = []
  const mappings = architecture.catalogDevelopmentMappings || []
  const mappingById = new Map(mappings.map((m) => [m.catalogCourseId, m]))
  const catalogById = new Map((catalog.courses || []).map((c) => [c.id, c]))
  const lessonById = new Map((lessons.lessonPlans || []).map((l) => [l.id, l]))
  const built = new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds || [])

  if (blockerAudit.phase !== '7F-E') errors.push('blocker audit phase must be 7F-E')
  if (blockerAudit.catalogCourseCount !== 68) errors.push('catalogCourseCount must remain 68')
  if (mappings.length !== blockerAudit.canonicalCatalogDevelopmentMappingCount) {
    errors.push(`canonical mapping count expected ${blockerAudit.canonicalCatalogDevelopmentMappingCount}, found ${mappings.length}`)
  }

  const unmapped = (catalog.courses || []).filter((c) => !mappingById.has(c.id)).map((c) => c.id).sort()
  const expectedUnmapped = [...(blockerAudit.allUnmappedCatalogCourseIds || [])].sort()
  if (JSON.stringify(unmapped) !== JSON.stringify(expectedUnmapped)) {
    errors.push(`unmapped catalog set drift: expected ${expectedUnmapped.join(',')}, found ${unmapped.join(',')}`)
  }

  for (const id of ['aut-120', 'aut-150']) {
    if (mappingById.has(id)) errors.push(`${id} must remain non-canonical until dedicated canonical content is approved`)
    const blocker = (blockerAudit.priorityBlockers || []).find((b) => b.courseId === id)
    if (!blocker) errors.push(`priority blocker record missing: ${id}`)
    if (blocker && blocker.blockerType !== 'missing-dedicated-canonical-catalog-content') {
      errors.push(`unexpected blocker type for ${id}`)
    }
  }

  for (const mapping of mappings) {
    if (mapping.mappingType !== 'canonical-catalog-course') {
      errors.push(`unexpected catalog development mapping type: ${mapping.catalogCourseId} -> ${mapping.mappingType}`)
    }
    if (mapping.catalogCourseId !== mapping.existingCourseId) {
      errors.push(`canonical identity invariant violated: ${mapping.catalogCourseId} != ${mapping.existingCourseId}`)
    }
  }

  if (batch3Plan.phase !== '7F-E' || batch3Plan.status !== 'planned-for-delivery-build') {
    errors.push('Batch 003 plan must remain Phase 7F-E planning-only')
  }

  const expectedBatch3 = ['aut-200', 'aut-201', 'aut-220']
  const batch3Ids = (batch3Plan.courses || []).map((c) => c.courseId)
  if (JSON.stringify(batch3Ids) !== JSON.stringify(expectedBatch3)) {
    errors.push(`Batch 003 must remain ${expectedBatch3.join(',')}`)
  }

  const sameBatch = new Set(batch3Ids)
  for (const planned of batch3Plan.courses || []) {
    const course = catalogById.get(planned.courseId)
    const mapping = mappingById.get(planned.courseId)
    if (!course) {
      errors.push(`Batch 003 catalog course missing: ${planned.courseId}`)
      continue
    }
    if (!mapping || mapping.mappingType !== 'canonical-catalog-course') {
      errors.push(`Batch 003 canonical mapping missing: ${planned.courseId}`)
      continue
    }
    if (mapping.existingLessonPlanId !== planned.lessonPlanId) {
      errors.push(`Batch 003 lesson mapping drift: ${planned.courseId}`)
    }
    if (!lessonById.has(planned.lessonPlanId)) {
      errors.push(`Batch 003 lesson plan missing: ${planned.lessonPlanId}`)
    }

    const catalogPrereqs = parsePrereqIds(course.prerequisites).sort()
    const plannedPrereqs = [...(planned.prerequisites || [])].sort()
    if (JSON.stringify(catalogPrereqs) !== JSON.stringify(plannedPrereqs)) {
      errors.push(`Batch 003 prerequisite drift: ${planned.courseId}`)
    }

    for (const prerequisite of plannedPrereqs) {
      if (!built.has(prerequisite) && !sameBatch.has(prerequisite)) {
        errors.push(`Batch 003 prerequisite is not satisfied: ${planned.courseId} -> ${prerequisite}`)
      }
    }

    if (fs.existsSync(path.join(ROOT, planned.targetPage))) {
      errors.push(`Batch 003 target already exists while plan is still planning-only: ${planned.targetPage}`)
    }
  }

  const boundaries = batch3Plan.boundaries || {}
  if (boundaries.coursesBuiltByThisPhase !== 0) errors.push('Phase 7F-E must build zero courses')
  if (boundaries.academicStatusChanges !== 0) errors.push('Phase 7F-E academicStatusChanges must remain zero')
  if (boundaries.assessmentEligibilityChanges !== 0) errors.push('Phase 7F-E assessmentEligibilityChanges must remain zero')
  if (boundaries.assessmentAuthorization !== false) errors.push('assessmentAuthorization must remain false')
  if (boundaries.productionReadyClaims !== 0) errors.push('productionReadyClaims must remain zero')

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      canonicalMappings: mappings.length,
      unmappedCatalogCourses: unmapped.length,
      priorityBlockers: ['aut-120', 'aut-150'],
      batch3: batch3Ids
    }
  }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-E mapping blocker and Batch 003 plan')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-E: 54 canonical mappings, 14 unmapped catalog records, AUT-120/AUT-150 intentionally blocked, Batch 003 aut-200/aut-201/aut-220 ready for build planning')
}

if (require.main === module) main()
module.exports = { parsePrereqIds, verify }

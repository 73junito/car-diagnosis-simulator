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

  if (!mappingById.has('aut-120')) errors.push('aut-120 canonical mapping must exist after Phase 7F-M resolution')
  const aut120 = mappingById.get('aut-120')
  if (aut120 && (aut120.existingCourseId !== 'aut-120' || aut120.existingLessonPlanId !== 'ug-aut120-electrical-fundamentals' || aut120.mappingType !== 'canonical-catalog-course')) {
    errors.push('aut-120 canonical mapping identity drift after Phase 7F-M resolution')
  }
  if (!(blockerAudit.resolvedSinceAudit || []).some((item) => item.courseId === 'aut-120' && item.resolutionPhase === '7F-M')) {
    errors.push('aut-120 Phase 7F-M resolution record missing')
  }
  const aut150Blocker = (blockerAudit.priorityBlockers || []).find((b) => b.courseId === 'aut-150')
  if (mappingById.has('aut-150')) errors.push('aut-150 must remain non-canonical until dedicated canonical content is approved')
  if (!aut150Blocker) errors.push('priority blocker record missing: aut-150')
  if (aut150Blocker && aut150Blocker.blockerType !== 'missing-dedicated-canonical-catalog-content') errors.push('unexpected blocker type for aut-150')

  for (const mapping of mappings) {
    if (mapping.mappingType !== 'canonical-catalog-course') {
      errors.push(`unexpected catalog development mapping type: ${mapping.catalogCourseId} -> ${mapping.mappingType}`)
    }
    if (mapping.catalogCourseId !== mapping.existingCourseId) {
      errors.push(`canonical identity invariant violated: ${mapping.catalogCourseId} != ${mapping.existingCourseId}`)
    }
  }

  if (!['7F-E', '7F-F'].includes(batch3Plan.phase)) {
    errors.push('Batch 003 plan phase must remain Phase 7F-E or completed Phase 7F-F')
  }
  if (batch3Plan.phase === '7F-F' && batch3Plan.status !== 'page-built-verified') {
    errors.push('Batch 003 must be page-built-verified in Phase 7F-F')
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

    if (batch3Plan.phase === '7F-E' && fs.existsSync(path.join(ROOT, planned.targetPage))) {
      errors.push(`Batch 003 target already exists while plan is still planning-only: ${planned.targetPage}`)
    }
    if (batch3Plan.phase === '7F-F') {
      if (!fs.existsSync(path.join(ROOT, planned.targetPage))) {
        errors.push(`Batch 003 verified target is missing: ${planned.targetPage}`)
      }
      if (planned.deliveryStatus !== 'page-built') {
        errors.push(`Batch 003 deliveryStatus must be page-built: ${planned.courseId}`)
      }
    }
  }

  const boundaries = batch3Plan.boundaries || {}
  if (batch3Plan.phase === '7F-E' && boundaries.coursesBuiltByThisPhase !== 0) errors.push('Phase 7F-E must build zero courses')
  if (batch3Plan.phase === '7F-F' && boundaries.coursesBuiltByThisPhase !== 3) errors.push('Phase 7F-F must record 3 built Batch 003 courses')
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
      priorityBlockers: ['aut-150'],
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
  console.log('[PASS] Phase 7F-E/F with Phase 7F-M resolution: 55 canonical mappings, 13 unmapped catalog records, AUT-120 resolved, AUT-150 still blocked, Batch 003 integrity verified')
}

if (require.main === module) main()
module.exports = { parsePrereqIds, verify }

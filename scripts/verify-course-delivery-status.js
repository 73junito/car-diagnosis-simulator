'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(ROOT, 'data', 'curriculum', 'course-delivery-status.json')
const CATALOG_PATH = path.join(ROOT, 'data', 'curriculum', 'course-catalog.json')
const UNDERGRAD_PATH = path.join(ROOT, 'data', 'curriculum', 'undergraduate-courses.json')
const GRAD_PATH = path.join(ROOT, 'data', 'curriculum', 'graduate-courses.json')
const LESSONS_PATH = path.join(ROOT, 'data', 'curriculum', 'lesson-plans.json')
const COURSES_DIR = path.join(ROOT, 'exam-site', 'courses')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function countByStatus(items) {
  return items.reduce((acc, item) => {
    const key = item.status || '<missing>'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function builtCourseIds() {
  if (!fs.existsSync(COURSES_DIR)) return []
  return fs.readdirSync(COURSES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => fs.existsSync(path.join(COURSES_DIR, id, 'index.html')))
    .sort()
}

function verify() {
  const errors = []
  const baseline = readJson(BASELINE_PATH)
  const catalog = readJson(CATALOG_PATH)
  const undergraduate = readJson(UNDERGRAD_PATH)
  const graduate = readJson(GRAD_PATH)
  const lessons = readJson(LESSONS_PATH)

  const catalogCourses = catalog.courses || []
  const undergradCourses = undergraduate.courses || []
  const gradCourses = graduate.courses || []
  const lessonPlans = lessons.lessonPlans || []
  const pageIds = builtCourseIds()

  const expected = baseline.baseline || {}

  if (baseline.phase !== '7F-I') errors.push('current delivery phase must remain 7F-I')
  if (baseline.purpose !== 'current-course-delivery-status') {
    errors.push('delivery status purpose must remain current-course-delivery-status')
  }

  if (catalog.catalogStatus !== expected.catalogStatus) {
    errors.push(`catalogStatus expected ${expected.catalogStatus}, found ${catalog.catalogStatus}`)
  }
  if (catalogCourses.length !== expected.catalogCourseCount) {
    errors.push(`catalog course count expected ${expected.catalogCourseCount}, found ${catalogCourses.length}`)
  }

  const catalogStatuses = countByStatus(catalogCourses)
  if ((catalogStatuses.planned || 0) !== expected.catalogPlannedCount) {
    errors.push(`catalog planned count expected ${expected.catalogPlannedCount}, found ${catalogStatuses.planned || 0}`)
  }

  if (lessonPlans.length !== expected.lessonPlanCount) {
    errors.push(`lesson plan count expected ${expected.lessonPlanCount}, found ${lessonPlans.length}`)
  }
  const undergradLessons = lessonPlans.filter((item) => item.academicLevel === 'undergraduate').length
  const gradLessons = lessonPlans.filter((item) => item.academicLevel === 'graduate').length
  if (undergradLessons !== expected.undergraduateLessonPlanCount) {
    errors.push(`undergraduate lesson plan count expected ${expected.undergraduateLessonPlanCount}, found ${undergradLessons}`)
  }
  if (gradLessons !== expected.graduateLessonPlanCount) {
    errors.push(`graduate lesson plan count expected ${expected.graduateLessonPlanCount}, found ${gradLessons}`)
  }

  if (undergradCourses.length !== expected.undergraduateCourseRecordCount) {
    errors.push(`undergraduate course record count expected ${expected.undergraduateCourseRecordCount}, found ${undergradCourses.length}`)
  }
  if (gradCourses.length !== expected.graduateCourseRecordCount) {
    errors.push(`graduate course record count expected ${expected.graduateCourseRecordCount}, found ${gradCourses.length}`)
  }

  const undergradStatuses = countByStatus(undergradCourses)
  const gradStatuses = countByStatus(gradCourses)
  for (const [status, count] of Object.entries(expected.undergraduateAcademicStatusCounts || {})) {
    if ((undergradStatuses[status] || 0) !== count) {
      errors.push(`undergraduate ${status} count expected ${count}, found ${undergradStatuses[status] || 0}`)
    }
  }
  for (const [status, count] of Object.entries(expected.graduateAcademicStatusCounts || {})) {
    if ((gradStatuses[status] || 0) !== count) {
      errors.push(`graduate ${status} count expected ${count}, found ${gradStatuses[status] || 0}`)
    }
  }

  const activeUndergradIds = undergradCourses
    .filter((item) => item.status === 'active')
    .map((item) => item.id)
    .sort()
  const expectedActive = [...(expected.activeUndergraduateAcademicCourseIds || [])].sort()
  if (JSON.stringify(activeUndergradIds) !== JSON.stringify(expectedActive)) {
    errors.push(`active undergraduate IDs expected ${expectedActive.join(',')}, found ${activeUndergradIds.join(',')}`)
  }

  const expectedPages = [...(expected.dedicatedCoursePageIds || [])].sort()
  if (JSON.stringify(pageIds) !== JSON.stringify(expectedPages)) {
    errors.push(`dedicated course/training page directories expected ${expectedPages.join(',')}, found ${pageIds.join(',')}`)
  }
  if (pageIds.length !== expected.dedicatedCoursePageCount) {
    errors.push(`dedicated course/training page directory count expected ${expected.dedicatedCoursePageCount}, found ${pageIds.length}`)
  }

  const catalogAlignedPages = [...(expected.catalogAlignedDedicatedCoursePageIds || [])].sort()
  if (catalogAlignedPages.length !== expected.catalogAlignedDedicatedCoursePageCount) {
    errors.push('catalog-aligned dedicated course page count does not match its ID list')
  }
  for (const id of catalogAlignedPages) {
    if (!pageIds.includes(id)) errors.push(`catalog-aligned page missing from filesystem page set: ${id}`)
  }

  const catalogIds = new Set(catalogCourses.map((item) => item.id))
  for (const id of catalogAlignedPages) {
    if (!catalogIds.has(id)) errors.push(`catalog-aligned built page is not represented in planning catalog: ${id}`)
  }

  const missingCatalogAlignedPageCount = catalogCourses.filter((item) => !catalogAlignedPages.includes(item.id)).length
  if (missingCatalogAlignedPageCount !== expected.catalogCoursesWithoutCatalogAlignedDedicatedPage) {
    errors.push(`catalog courses without catalog-aligned dedicated page expected ${expected.catalogCoursesWithoutCatalogAlignedDedicatedPage}, found ${missingCatalogAlignedPageCount}`)
  }

  const activeWithPage = activeUndergradIds.filter((id) => pageIds.includes(id))
  if (activeWithPage.length !== 0) {
    errors.push('academic active status must not be treated as delivery-page status')
  }

  const boundaries = baseline.boundaries || {}
  for (const key of [
    'fullSyllabusCoverageClaim',
    'fullCourseDeliveryCoverageClaim',
    'assessmentAuthorization',
    'scoringAuthorization',
    'gradingAuthorization',
    'highStakesAuthorization'
  ]) {
    if (boundaries[key] !== false) errors.push(`delivery baseline boundary must remain false: ${key}`)
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      catalogCourses: catalogCourses.length,
      lessonPlans: lessonPlans.length,
      dedicatedCoursePages: pageIds,
      catalogAlignedDedicatedCoursePages: [...(expected.catalogAlignedDedicatedCoursePageIds || [])].sort(),
      activeUndergraduateAcademicCourseIds: activeUndergradIds
    }
  }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-I course delivery status')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log(
    `[PASS] Phase 7F-I course delivery status: ${result.summary.catalogAlignedDedicatedCoursePages.length} catalog-aligned course pages plus ${result.summary.dedicatedCoursePages.length - result.summary.catalogAlignedDedicatedCoursePages.length} legacy training page; academic status remains separate from delivery status`
  )
}

if (require.main === module) main()

module.exports = { builtCourseIds, verify }

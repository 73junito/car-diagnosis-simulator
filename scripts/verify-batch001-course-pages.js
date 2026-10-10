'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'course-catalog.json'), 'utf8')).courses
const LESSONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'lesson-plans.json'), 'utf8')).lessonPlans
const ARCH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'program-architecture.json'), 'utf8'))
const STATUS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'course-delivery-status.json'), 'utf8'))

const BATCH = ['aut-101', 'aut-105', 'aut-110', 'aut-115']

function readPage(id) {
  const file = path.join(ROOT, 'exam-site', 'courses', id, 'index.html')
  return { file, html: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null }
}

function verify() {
  const errors = []
  const catalogById = new Map(CATALOG.map((course) => [course.id, course]))
  const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]))
  const mappingByCourse = new Map(
    (ARCH.catalogDevelopmentMappings || []).map((mapping) => [mapping.catalogCourseId, mapping])
  )
  const built = new Set(STATUS.baseline?.dedicatedCoursePageIds || [])
  const catalogAligned = new Set(STATUS.baseline?.catalogAlignedDedicatedCoursePageIds || [])

  if (!['7F-C', '7F-D', '7F-F', '7F-H', '7F-I', '7F-J', '7F-K', '7F-N'].includes(STATUS.phase)) errors.push('delivery status must be Phase 7F-C or later supported Phase 7F-N')
  for (const id of BATCH) {
    if (!catalogAligned.has(id)) errors.push(`Batch 001 catalog-aligned page missing from current delivery status: ${id}`)
  }
  if (JSON.stringify(STATUS.baseline?.legacyTrainingPackagePageIds || []) !== JSON.stringify(['aut-250'])) {
    errors.push('AUT-250 must remain classified as the legacy HEV training package page')
  }

  for (const id of BATCH) {
    const course = catalogById.get(id)
    const mapping = mappingByCourse.get(id)
    if (!course) {
      errors.push(`catalog course missing: ${id}`)
      continue
    }
    if (!mapping || mapping.mappingType !== 'canonical-catalog-course') {
      errors.push(`canonical catalog-development mapping missing: ${id}`)
      continue
    }

    const lesson = lessonById.get(mapping.existingLessonPlanId)
    if (!lesson) errors.push(`mapped lesson plan missing: ${id} -> ${mapping.existingLessonPlanId}`)
    if (lesson && lesson.courseId !== id) errors.push(`lesson courseId mismatch for ${id}`)

    const { file, html } = readPage(id)
    if (!html) {
      errors.push(`dedicated course page missing: ${path.relative(ROOT, file)}`)
      continue
    }

    const expectedCanonical = `https://exam.autolearnpro.com/courses/${id}/`
    const required = [
      course.code,
      course.title,
      course.description,
      course.credits,
      course.prerequisites,
      mapping.existingLessonPlanId,
      lesson?.title,
      expectedCanonical,
      'Instructional and formative use only.',
      'does not authorize scoring, grading, institutional assessment, or high-stakes use',
      'Page availability is not a grade, score, certification, accreditation decision, academic-credit authorization, or assessment release.'
    ]

    for (const value of required.filter(Boolean)) {
      if (!html.includes(String(value).replace(/&/g, '&amp;'))) {
        if (!html.includes(String(value))) errors.push(`${id} page missing required governed content: ${value}`)
      }
    }

    if (!html.includes('<meta name="robots" content="noindex, nofollow">')) {
      errors.push(`${id} page must remain noindex,nofollow`)
    }

    for (const step of lesson?.sequence || []) {
      if (!html.includes(step.replace(/&/g, '&amp;'))) {
        errors.push(`${id} page missing lesson sequence step: ${step}`)
      }
    }

    if (!built.has(id)) errors.push(`delivery status does not list built page: ${id}`)
    if (!catalogAligned.has(id)) errors.push(`delivery status does not list catalog-aligned page: ${id}`)
  }

  for (const id of [...BATCH, 'aut-250']) {
    if (!built.has(id)) errors.push(`required historical built page missing from current delivery state: ${id}`)
  }

  const syncScript = fs.readFileSync(path.join(ROOT, 'scripts', 'sync-exam-curriculum.js'), 'utf8')
  if (!syncScript.includes('"course-delivery-status.json"')) {
    errors.push('exam curriculum sync must include course-delivery-status.json')
  }

  const catalogData = fs.readFileSync(path.join(ROOT, 'exam-site', 'catalog', 'catalog-data.js'), 'utf8')
  if (!catalogData.includes('DELIVERY_STATUS_URL') ||
      !catalogData.includes('catalogAlignedDedicatedCoursePageIds') ||
      !catalogData.includes('course-page')) {
    errors.push('catalog data loader must attach only governed catalog-aligned delivery-page availability')
  }

  const courseDetail = fs.readFileSync(path.join(ROOT, 'exam-site', 'catalog', 'course', 'course.js'), 'utf8')
  if (!courseDetail.includes('Open course page')) {
    errors.push('catalog course detail must expose the dedicated course page link')
  }

  return { ok: errors.length === 0, errors, batch: BATCH }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-C Batch 001 course pages')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-C Batch 001: AUT-101/AUT-105/AUT-110/AUT-115 pages are built, governed, catalog-linked, and non-assessment')
}

if (require.main === module) main()

module.exports = { BATCH, verify }

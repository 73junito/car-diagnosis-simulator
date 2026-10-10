'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'course-catalog.json'), 'utf8')).courses
const LESSONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'lesson-plans.json'), 'utf8')).lessonPlans
const ARCH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'program-architecture.json'), 'utf8'))
const STATUS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'course-delivery-status.json'), 'utf8'))

const BATCH = ['aut-130', 'aut-131', 'aut-160', 'aut-180']

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
  const catalogAligned = new Set(STATUS.baseline?.catalogAlignedDedicatedCoursePageIds || [])

  if (!['7F-D', '7F-F', '7F-H', '7F-I', '7F-J', '7F-K', '7F-N', '7F-O', '7F-P', '7F-R', '7F-S', '7F-T', '7F-U', '7F-V', '7F-W'].includes(STATUS.phase)) errors.push('delivery status must be Phase 7F-D or later supported Phase 7F-W')
  if ((STATUS.baseline?.catalogAlignedDedicatedCoursePageCount || 0) < 8) {
    errors.push('current delivery status must retain at least the 8 Batch 001/002 catalog-aligned pages')
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
      const escaped = String(value).replace(/&/g, '&amp;')
      if (!html.includes(escaped) && !html.includes(String(value))) {
        errors.push(`${id} page missing required governed content: ${value}`)
      }
    }

    if (!html.includes('<meta name="robots" content="noindex, nofollow">')) {
      errors.push(`${id} page must remain noindex,nofollow`)
    }

    for (const step of lesson?.sequence || []) {
      const escaped = step.replace(/&/g, '&amp;')
      if (!html.includes(escaped) && !html.includes(step)) {
        errors.push(`${id} page missing lesson sequence step: ${step}`)
      }
    }

    if (!catalogAligned.has(id)) {
      errors.push(`delivery status does not list catalog-aligned Batch 002 page: ${id}`)
    }
  }

  const aut131 = catalogById.get('aut-131')
  if (aut131?.prerequisites !== 'Concurrent enrollment in AUT 130') {
    errors.push('AUT-131 concurrent prerequisite must remain exactly aligned to the catalog')
  }

  return { ok: errors.length === 0, errors, batch: BATCH }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-D Batch 002 course pages')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-D Batch 002: AUT-130/AUT-131/AUT-160/AUT-180 pages are built, governed, catalog-aligned, and non-assessment')
}

if (require.main === module) main()

module.exports = { BATCH, verify }

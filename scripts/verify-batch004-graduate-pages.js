'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const lessons = read('data/curriculum/lesson-plans.json')
const architecture = read('data/curriculum/program-architecture.json')
const delivery = read('data/curriculum/course-delivery-status.json')
const plan = read('data/curriculum/course-delivery-batch004-plan.json')

const BATCH = ['aut-501', 'aut-515', 'aut-590']

function verify() {
  const errors = []
  const catalogById = new Map((catalog.courses || []).map((c) => [c.id, c]))
  const lessonById = new Map((lessons.lessonPlans || []).map((l) => [l.id, l]))
  const mappingById = new Map((architecture.catalogDevelopmentMappings || []).map((m) => [m.catalogCourseId, m]))
  const aligned = new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds || [])

  if (!['7F-H', '7F-I', '7F-J'].includes(delivery.phase)) errors.push('delivery status must be Phase 7F-H or later supported Phase 7F-J')
  if ((delivery.baseline?.catalogAlignedDedicatedCoursePageCount || 0) < 14) {
    errors.push('delivery status must retain at least the 14 Phase 7F-H catalog-aligned course pages')
  }
  if (plan.phase !== '7F-H' || plan.status !== 'page-built-verified') {
    errors.push('Batch 004 execution must be page-built-verified in Phase 7F-H')
  }

  for (const id of BATCH) {
    const course = catalogById.get(id)
    const mapping = mappingById.get(id)
    const planned = (plan.courses || []).find((c) => c.courseId === id)
    if (!course) {
      errors.push(`catalog course missing: ${id}`)
      continue
    }
    if (course.academicLevel !== 'graduate') errors.push(`catalog course must remain graduate: ${id}`)
    if (!mapping || mapping.mappingType !== 'canonical-catalog-course' || mapping.existingCourseId !== id) {
      errors.push(`identity-preserving canonical mapping missing: ${id}`)
      continue
    }

    const lesson = lessonById.get(mapping.existingLessonPlanId)
    if (!lesson || lesson.courseId !== id || lesson.academicLevel !== 'graduate') {
      errors.push(`graduate lesson mismatch: ${id}`)
    }
    if (!planned || planned.lessonPlanId !== mapping.existingLessonPlanId || planned.deliveryStatus !== 'page-built') {
      errors.push(`Batch 004 plan drift: ${id}`)
    }
    if (planned && planned.prerequisiteDisposition !== 'requires-human-or-institutional-verification') {
      errors.push(`institutional prerequisite boundary drift: ${id}`)
    }

    const file = path.join(ROOT, 'exam-site', 'courses', id, 'index.html')
    if (!fs.existsSync(file)) {
      errors.push(`dedicated graduate course page missing: ${id}`)
      continue
    }
    const html = fs.readFileSync(file, 'utf8')
    const required = [
      course.code,
      course.title,
      course.description,
      course.credits,
      course.prerequisites,
      mapping.existingLessonPlanId,
      lesson?.title,
      `https://exam.autolearnpro.com/courses/${id}/`,
      'GRADUATE INSTRUCTIONAL COURSE PAGE',
      'Eligibility verification required.',
      'Page availability does not establish that a learner satisfies degree, mathematics-preparation, graduate-standing, admissions, or other institutional requirements.',
      'does not authorize admissions, prerequisite satisfaction, scoring, grading, institutional assessment, or high-stakes use',
      'Any such decision requires separate human or institutional governance.'
    ]

    for (const value of required.filter(Boolean)) {
      const raw = String(value)
      const escaped = raw.replace(/&/g, '&amp;')
      if (!html.includes(raw) && !html.includes(escaped)) {
        errors.push(`${id} page missing required governed content: ${raw}`)
      }
    }

    for (const step of lesson?.sequence || []) {
      const escaped = step.replace(/&/g, '&amp;')
      if (!html.includes(step) && !html.includes(escaped)) {
        errors.push(`${id} page missing lesson sequence step: ${step}`)
      }
    }

    if (!html.includes('<meta name="robots" content="noindex, nofollow">')) {
      errors.push(`${id} page must remain noindex,nofollow`)
    }
    if (!aligned.has(id)) errors.push(`delivery status missing catalog-aligned graduate page: ${id}`)
  }

  return { ok: errors.length === 0, errors, batch: BATCH }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-H Batch 004 graduate pages')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-H Batch 004: AUT-501/AUT-515/AUT-590 pages are built, catalog-aligned, eligibility-bounded, and non-assessment')
}

if (require.main === module) main()
module.exports = { BATCH, verify }

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const catalog = read('data/curriculum/course-catalog.json')
const lessons = read('data/curriculum/lesson-plans.json')
const architecture = read('data/curriculum/program-architecture.json')
const delivery = read('data/curriculum/course-delivery-status.json')
const plan = read('data/curriculum/course-delivery-batch005-plan.json')

const BATCH = ['aut-520', 'aut-530', 'aut-550']

function verify() {
  const errors = []
  const catalogById = new Map((catalog.courses || []).map((c) => [c.id, c]))
  const lessonById = new Map((lessons.lessonPlans || []).map((l) => [l.id, l]))
  const mappingById = new Map((architecture.catalogDevelopmentMappings || []).map((m) => [m.catalogCourseId, m]))
  const aligned = new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds || [])

  if (delivery.phase !== '7F-I') errors.push('delivery status must be Phase 7F-I')
  if (delivery.baseline?.catalogAlignedDedicatedCoursePageCount !== 17) errors.push('Phase 7F-I must record 17 catalog-aligned course pages')
  if (plan.phase !== '7F-I' || plan.status !== 'page-built-verified') errors.push('Batch 005 execution must be page-built-verified in Phase 7F-I')

  for (const id of BATCH) {
    const course = catalogById.get(id)
    const mapping = mappingById.get(id)
    const planned = (plan.courses || []).find((c) => c.courseId === id)
    if (!course) { errors.push(`catalog course missing: ${id}`); continue }
    if (course.academicLevel !== 'graduate') errors.push(`catalog course must remain graduate: ${id}`)
    if (!mapping || mapping.mappingType !== 'canonical-catalog-course' || mapping.existingCourseId !== id) {
      errors.push(`identity-preserving canonical mapping missing: ${id}`)
      continue
    }
    const lesson = lessonById.get(mapping.existingLessonPlanId)
    if (!lesson || lesson.courseId !== id || lesson.academicLevel !== 'graduate') errors.push(`graduate lesson mismatch: ${id}`)
    if (!planned || planned.lessonPlanId !== mapping.existingLessonPlanId || planned.deliveryStatus !== 'page-built') errors.push(`Batch 005 plan drift: ${id}`)
    if (planned && planned.prerequisiteDisposition !== 'requires-human-or-institutional-verification') errors.push(`institutional prerequisite boundary drift: ${id}`)

    const file = path.join(ROOT, 'exam-site', 'courses', id, 'index.html')
    if (!fs.existsSync(file)) { errors.push(`dedicated graduate course page missing: ${id}`); continue }
    const html = fs.readFileSync(file, 'utf8')
    const required = [
      course.code, course.title, course.description, course.credits, course.prerequisites,
      mapping.existingLessonPlanId, lesson?.title, `https://exam.autolearnpro.com/courses/${id}/`,
      'GRADUATE INSTRUCTIONAL COURSE PAGE', 'Eligibility verification required.',
      'does not authorize admissions, prerequisite satisfaction, scoring, grading, institutional assessment, or high-stakes use',
      'Any such decision requires separate human or institutional governance.'
    ]
    for (const value of required.filter(Boolean)) {
      const raw = String(value), escaped = raw.replace(/&/g, '&amp;')
      if (!html.includes(raw) && !html.includes(escaped)) errors.push(`${id} page missing required governed content: ${raw}`)
    }
    for (const step of lesson?.sequence || []) {
      const escaped = step.replace(/&/g, '&amp;')
      if (!html.includes(step) && !html.includes(escaped)) errors.push(`${id} page missing lesson sequence step: ${step}`)
    }
    if (!html.includes('<meta name="robots" content="noindex, nofollow">')) errors.push(`${id} page must remain noindex,nofollow`)
    if (!aligned.has(id)) errors.push(`delivery status missing catalog-aligned graduate page: ${id}`)
  }

  const aut530 = fs.readFileSync(path.join(ROOT, 'exam-site', 'courses', 'aut-530', 'index.html'), 'utf8')
  if (!aut530.includes('Undergraduate EV coursework or equivalent requires separate human or institutional verification.')) {
    errors.push('AUT-530 must preserve the undergraduate EV coursework/equivalency human-verification boundary')
  }

  return { ok: errors.length === 0, errors, batch: BATCH }
}

function main() {
  const result = verify()
  if (!result.ok) {
    console.error('[FAIL] Phase 7F-I Batch 005 graduate pages')
    for (const error of result.errors) console.error('  - ' + error)
    process.exit(1)
  }
  console.log('[PASS] Phase 7F-I Batch 005: AUT-520/AUT-530/AUT-550 pages are built, catalog-aligned, eligibility-bounded, and non-assessment')
}

if (require.main === module) main()
module.exports = { BATCH, verify }

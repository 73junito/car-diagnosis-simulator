'use strict'

const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT,'data','curriculum','course-catalog.json'),'utf8')).courses
const LESSONS = JSON.parse(fs.readFileSync(path.join(ROOT,'data','curriculum','lesson-plans.json'),'utf8')).lessonPlans
const ARCH = JSON.parse(fs.readFileSync(path.join(ROOT,'data','curriculum','program-architecture.json'),'utf8'))
const STATUS = JSON.parse(fs.readFileSync(path.join(ROOT,'data','curriculum','course-delivery-status.json'),'utf8'))
const PLAN = JSON.parse(fs.readFileSync(path.join(ROOT,'data','curriculum','course-delivery-batch003-plan.json'),'utf8'))
const BATCH = ['aut-200','aut-201','aut-220']

function verify() {
  const errors=[]
  const catalogById=new Map(CATALOG.map(c=>[c.id,c]))
  const lessonById=new Map(LESSONS.map(l=>[l.id,l]))
  const mappingById=new Map((ARCH.catalogDevelopmentMappings||[]).map(m=>[m.catalogCourseId,m]))
  const aligned=new Set(STATUS.baseline?.catalogAlignedDedicatedCoursePageIds||[])

  if (!['7F-F','7F-H'].includes(STATUS.phase)) errors.push('delivery status must be Phase 7F-F or later supported Phase 7F-H')
  if ((STATUS.baseline?.catalogAlignedDedicatedCoursePageCount||0)<11) errors.push('current delivery status must retain at least 11 catalog-aligned course pages')
  if (PLAN.phase!=='7F-F' || PLAN.status!=='page-built-verified') errors.push('Batch 003 execution must be page-built-verified in Phase 7F-F')

  for (const id of BATCH) {
    const course=catalogById.get(id)
    const mapping=mappingById.get(id)
    const planned=(PLAN.courses||[]).find(c=>c.courseId===id)
    if (!course) { errors.push('catalog course missing: '+id); continue }
    if (!mapping || mapping.mappingType!=='canonical-catalog-course' || mapping.existingCourseId!==id) {
      errors.push('identity-preserving canonical mapping missing: '+id); continue
    }
    const lesson=lessonById.get(mapping.existingLessonPlanId)
    if (!lesson || lesson.courseId!==id) errors.push('mapped lesson mismatch: '+id)
    if (!planned || planned.lessonPlanId!==mapping.existingLessonPlanId || planned.deliveryStatus!=='page-built') {
      errors.push('Batch 003 plan drift: '+id)
    }
    const file=path.join(ROOT,'exam-site','courses',id,'index.html')
    if (!fs.existsSync(file)) { errors.push('dedicated course page missing: '+id); continue }
    const html=fs.readFileSync(file,'utf8')
    const required=[course.code,course.title,course.description,course.credits,course.prerequisites,mapping.existingLessonPlanId,lesson?.title,`https://exam.autolearnpro.com/courses/${id}/`,'Instructional and formative use only.','does not authorize scoring, grading, institutional assessment, or high-stakes use']
    for (const value of required.filter(Boolean)) {
      const s=String(value), e=s.replace(/&/g,'&amp;')
      if (!html.includes(s) && !html.includes(e)) errors.push(`${id} page missing governed content: ${s}`)
    }
    for (const step of lesson?.sequence||[]) {
      const e=step.replace(/&/g,'&amp;')
      if (!html.includes(step) && !html.includes(e)) errors.push(`${id} page missing lesson step: ${step}`)
    }
    if (!html.includes('<meta name="robots" content="noindex, nofollow">')) errors.push(id+' page must remain noindex,nofollow')
    if (!aligned.has(id)) errors.push('delivery status missing catalog-aligned page: '+id)
  }

  if (catalogById.get('aut-201')?.prerequisites!=='Concurrent enrollment in AUT 200') {
    errors.push('AUT-201 concurrent prerequisite must remain exact')
  }

  return {ok:errors.length===0,errors,batch:BATCH}
}
function main(){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-F Batch 003 course pages');for(const e of r.errors) console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-F Batch 003: AUT-200/AUT-201/AUT-220 pages are built, governed, catalog-aligned, and non-assessment')}
if(require.main===module) main()
module.exports={BATCH,verify}

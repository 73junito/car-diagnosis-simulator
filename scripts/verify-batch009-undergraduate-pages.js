'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const catalog=read('data/curriculum/course-catalog.json')
const lessons=read('data/curriculum/lesson-plans.json')
const arch=read('data/curriculum/program-architecture.json')
const delivery=read('data/curriculum/course-delivery-status.json')
const plan=read('data/curriculum/course-delivery-batch009-plan.json')
const BATCH=['aut-121','aut-170']
function verify(){
 const errors=[]
 const cb=new Map((catalog.courses||[]).map(c=>[c.id,c]))
 const mb=new Map((arch.catalogDevelopmentMappings||[]).map(m=>[m.catalogCourseId,m]))
 const lb=new Map((lessons.lessonPlans||[]).map(l=>[l.id,l]))
 const aligned=new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds||[])
 if(!['7F-O','7F-P', '7F-R', '7F-S', '7F-T', '7F-U', '7F-V'].includes(delivery.phase)) errors.push('delivery status must be Phase 7F-O or later supported Phase 7F-V')
 if((delivery.baseline?.catalogAlignedDedicatedCoursePageCount||0)<30) errors.push('delivery status must retain at least the 30 Phase 7F-O aligned pages')
 if((delivery.baseline?.catalogCoursesWithoutCatalogAlignedDedicatedPage||0)>38) errors.push('delivery status must not regress above the 38-course Phase 7F-O remaining baseline')
 if(plan.phase!=='7F-O'||plan.status!=='page-built-verified') errors.push('Batch 009 must be page-built-verified in Phase 7F-O')
 for(const id of BATCH){
  const c=cb.get(id),m=mb.get(id),l=lb.get(m?.existingLessonPlanId),p=(plan.courses||[]).find(x=>x.courseId===id)
  if(!c) {errors.push('catalog course missing: '+id);continue}
  if(c.academicLevel!=='undergraduate') errors.push('course must remain undergraduate: '+id)
  if(!m||m.mappingType!=='canonical-catalog-course'||m.existingCourseId!==id) errors.push('identity-preserving mapping missing: '+id)
  if(!l||l.courseId!==id||l.academicLevel!=='undergraduate') errors.push('lesson mismatch: '+id)
  if(!p||p.lessonPlanId!==m?.existingLessonPlanId||p.deliveryStatus!=='page-built') errors.push('Batch 009 plan drift: '+id)
  if(p&&p.prerequisiteDisposition!=='requires-human-or-institutional-verification') errors.push('prerequisite boundary drift: '+id)
  const file=path.join(ROOT,'exam-site','courses',id,'index.html')
  if(!fs.existsSync(file)){errors.push('course page missing: '+id);continue}
  const html=fs.readFileSync(file,'utf8')
  const req=[c.code,c.title,c.description,String(c.credits),c.prerequisites,m.existingLessonPlanId,l?.title,`https://exam.autolearnpro.com/courses/${id}/`,'INSTRUCTIONAL COURSE PAGE','Eligibility verification required.','does not authorize prerequisite satisfaction, scoring, grading, institutional assessment, or high-stakes use','Any such decision requires separate human or institutional governance.']
  for(const v of req.filter(Boolean)) if(!html.includes(v)&&!html.includes(String(v).replace(/&/g,'&amp;'))) errors.push(id+' page missing: '+v)
  for(const step of l?.sequence||[]) if(!html.includes(step)) errors.push(id+' page missing lesson step: '+step)
  if(!html.includes('<meta name="robots" content="noindex, nofollow">')) errors.push(id+' page must remain noindex,nofollow')
  if(!aligned.has(id)) errors.push('delivery status missing aligned page: '+id)
 }
 return {ok:errors.length===0,errors,batch:BATCH}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-O Batch 009 undergraduate pages');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-O Batch 009: AUT-121/AUT-170 pages are built, catalog-aligned, prerequisite-bounded, and non-assessment')}
module.exports={BATCH,verify}

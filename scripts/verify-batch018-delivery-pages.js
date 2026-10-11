'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const catalog=read('data/curriculum/course-catalog.json')
const lessons=read('data/curriculum/lesson-plans.json')
const arch=read('data/curriculum/program-architecture.json')
const delivery=read('data/curriculum/course-delivery-status.json')
const plan=read('data/curriculum/course-delivery-batch018-plan.json')
const BATCH=['aut-610','aut-650']
function verify(){
 const errors=[]
 const cb=new Map((catalog.courses||[]).map(c=>[c.id,c]))
 const mb=new Map((arch.catalogDevelopmentMappings||[]).map(m=>[m.catalogCourseId,m]))
 const lb=new Map((lessons.lessonPlans||[]).map(l=>[l.id,l]))
 const aligned=new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds||[])
 if(delivery.phase!=='7F-Z') errors.push('delivery status must be Phase 7F-Z')
 if(delivery.baseline?.catalogAlignedDedicatedCoursePageCount!==60) errors.push('Phase 7F-Z must record 60 aligned pages')
 if(delivery.baseline?.catalogCoursesWithoutCatalogAlignedDedicatedPage!==8) errors.push('Phase 7F-Z must record 8 catalog courses without aligned pages')
 if(plan.phase!=='7F-Z'||plan.status!=='page-built-verified') errors.push('Batch 018 must be page-built-verified in Phase 7F-Z')
 for(const id of BATCH){
  const c=cb.get(id),m=mb.get(id),l=lb.get(m?.existingLessonPlanId),p=(plan.courses||[]).find(x=>x.courseId===id)
  if(!c){errors.push('catalog course missing: '+id);continue}
  if(!m||m.mappingType!=='canonical-catalog-course'||m.existingCourseId!==id) errors.push('identity-preserving mapping missing: '+id)
  if(!l||l.courseId!==id||l.academicLevel!==c.academicLevel) errors.push('lesson mismatch: '+id)
  if(!p||p.lessonPlanId!==m?.existingLessonPlanId||p.deliveryStatus!=='page-built') errors.push('Batch 018 plan drift: '+id)
  if(p&&p.prerequisiteDisposition!=='requires-human-or-institutional-verification') errors.push('prerequisite boundary drift: '+id)
  const file=path.join(ROOT,'exam-site','courses',id,'index.html')
  if(!fs.existsSync(file)){errors.push('course page missing: '+id);continue}
  const html=fs.readFileSync(file,'utf8')
  for(const v of [c.code,c.title,c.description,String(c.credits),c.prerequisites,m.existingLessonPlanId,l?.title,`https://exam.autolearnpro.com/courses/${id}/`,'INSTRUCTIONAL COURSE PAGE','Eligibility verification required.','Any such decision requires separate human or institutional governance.'].filter(Boolean)) if(!html.includes(v)) errors.push(id+' page missing: '+v)
  for(const step of l?.sequence||[]) if(!html.includes(step)) errors.push(id+' page missing lesson step: '+step)
  if(!html.includes('<meta name="robots" content="noindex, nofollow">')) errors.push(id+' page must remain noindex,nofollow')
  if(!aligned.has(id)) errors.push('delivery status missing aligned page: '+id)
 }
 return {ok:errors.length===0,errors,batch:BATCH}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-Z Batch 018 delivery pages');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-Z Batch 018: AUT-610/AUT-650 pages are built, catalog-aligned, eligibility-bounded, and non-assessment')}
module.exports={BATCH,verify}

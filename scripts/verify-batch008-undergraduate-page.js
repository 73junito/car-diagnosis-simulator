'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const catalog=read('data/curriculum/course-catalog.json')
const lessons=read('data/curriculum/lesson-plans.json')
const arch=read('data/curriculum/program-architecture.json')
const delivery=read('data/curriculum/course-delivery-status.json')
const plan=read('data/curriculum/course-delivery-batch008-plan.json')
function verify(){
 const errors=[], id='aut-120'
 const c=(catalog.courses||[]).find(x=>x.id===id)
 const m=(arch.catalogDevelopmentMappings||[]).find(x=>x.catalogCourseId===id)
 const l=(lessons.lessonPlans||[]).find(x=>x.id===m?.existingLessonPlanId)
 const p=(plan.courses||[]).find(x=>x.courseId===id)
 if(!['7F-N','7F-O', '7F-P'].includes(delivery.phase)) errors.push('delivery status must be Phase 7F-N or later supported Phase 7F-P')
 if((delivery.baseline?.catalogAlignedDedicatedCoursePageCount||0)<28) errors.push('delivery status must retain at least the 28 Phase 7F-N aligned pages')
 if((delivery.baseline?.catalogCoursesWithoutCatalogAlignedDedicatedPage||0)>40) errors.push('delivery status must not regress above the 40-course Phase 7F-N remaining baseline')
 if(plan.phase!=='7F-N'||plan.status!=='page-built-verified') errors.push('Batch 008 must be built/verified in Phase 7F-N')
 if(!c||c.code!=='AUT 120') errors.push('AUT-120 catalog identity missing')
 if(!m||m.mappingType!=='canonical-catalog-course'||m.existingCourseId!==id||m.existingLessonPlanId!=='ug-aut120-electrical-fundamentals') errors.push('AUT-120 canonical mapping drift')
 if(!l||l.courseId!==id||l.academicLevel!=='undergraduate') errors.push('AUT-120 lesson identity drift')
 if(!p||p.prerequisiteDisposition!=='requires-human-or-institutional-verification'||p.deliveryStatus!=='page-built') errors.push('Batch 008 governance/delivery plan drift')
 const file=path.join(ROOT,'exam-site','courses',id,'index.html')
 if(!fs.existsSync(file)) errors.push('AUT-120 page missing')
 else {
  const html=fs.readFileSync(file,'utf8')
  const required=[c.code,c.title,c.description,String(c.credits),c.prerequisites,m.existingLessonPlanId,l?.title,'https://exam.autolearnpro.com/courses/aut-120/','INSTRUCTIONAL COURSE PAGE','Eligibility verification required.','does not authorize prerequisite satisfaction, scoring, grading, institutional assessment, or high-stakes use','Any such decision requires separate human or institutional governance.']
  for(const v of required.filter(Boolean)) if(!html.includes(v)&&!html.includes(String(v).replace(/&/g,'&amp;'))) errors.push('AUT-120 page missing: '+v)
  for(const step of l?.sequence||[]) if(!html.includes(step)) errors.push('AUT-120 page missing lesson step: '+step)
  if(!html.includes('<meta name="robots" content="noindex, nofollow">')) errors.push('AUT-120 page must remain noindex,nofollow')
 }
 if(!(delivery.baseline?.catalogAlignedDedicatedCoursePageIds||[]).includes(id)) errors.push('AUT-120 missing from aligned delivery IDs')
 return {ok:errors.length===0,errors,batch:[id]}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-N Batch 008 AUT-120 page');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-N Batch 008: AUT-120 page is built, catalog-aligned, prerequisite-bounded, and non-assessment')}
module.exports={verify}

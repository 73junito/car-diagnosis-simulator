'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const catalog=read('data/curriculum/course-catalog.json')
const lessons=read('data/curriculum/lesson-plans.json')
const arch=read('data/curriculum/program-architecture.json')
const delivery=read('data/curriculum/course-delivery-status.json')
const plan=read('data/curriculum/course-delivery-batch014-plan.json')
const BATCH=['aut-300','aut-310','aut-320','aut-330']
function verify(){
 const errors=[]
 const cb=new Map((catalog.courses||[]).map(c=>[c.id,c]))
 const mb=new Map((arch.catalogDevelopmentMappings||[]).map(m=>[m.catalogCourseId,m]))
 const lb=new Map((lessons.lessonPlans||[]).map(l=>[l.id,l]))
 const aligned=new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds||[])
 const routes=delivery.baseline?.catalogAlignedDedicatedCoursePageRoutes||{}
 if(!['7F-U','7F-V', '7F-W'].includes(delivery.phase)) errors.push('delivery status must be Phase 7F-U or later supported Phase 7F-W')
 if((delivery.baseline?.catalogAlignedDedicatedCoursePageCount||0)<45) errors.push('delivery status must retain at least the 45 Phase 7F-U aligned pages')
 if((delivery.baseline?.catalogCoursesWithoutCatalogAlignedDedicatedPage||0)>23) errors.push('delivery status must not regress above the 23-course Phase 7F-U remaining baseline')
 if(plan.phase!=='7F-U'||plan.status!=='page-built-verified') errors.push('Batch 014 must be page-built-verified in Phase 7F-U')
 if(routes['aut-250']!=='/courses/aut-250-diagnostics/') errors.push('catalog AUT-250 collision-safe route must remain unchanged')
 if(routes['aut-330']!=='/courses/aut-330/') errors.push('catalog AUT-330 must now use its canonical /courses/aut-330/ route')
 for(const id of BATCH){
  const c=cb.get(id),m=mb.get(id),l=lb.get(m?.existingLessonPlanId),p=(plan.courses||[]).find(x=>x.courseId===id)
  if(!c){errors.push('catalog course missing: '+id);continue}
  if(!m||m.mappingType!=='canonical-catalog-course'||m.existingCourseId!==id) errors.push('identity-preserving mapping missing: '+id)
  if(!l||l.courseId!==id||l.academicLevel!==c.academicLevel) errors.push('lesson mismatch: '+id)
  if(!p||p.lessonPlanId!==m?.existingLessonPlanId||p.deliveryStatus!=='page-built') errors.push('Batch 014 plan drift: '+id)
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
 const legacy=fs.readFileSync(path.join(ROOT,'exam-site','courses','aut-250','index.html'),'utf8')
 if(!legacy.includes('Hybrid &amp; Electric Vehicle')) errors.push('legacy /courses/aut-250/ HEV package must remain unchanged in identity')
 if(legacy.includes('Electric Vehicle Technology')) errors.push('legacy /courses/aut-250/ must not be relabeled as AUT-330')
 const aut330=fs.readFileSync(path.join(ROOT,'exam-site','courses','aut-330','index.html'),'utf8')
 if(!aut330.includes('/courses/aut-250/')) errors.push('AUT-330 canonical page must preserve link to historical HEV package')
 return {ok:errors.length===0,errors,batch:BATCH}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-U Batch 014 delivery pages');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-U Batch 014: AUT-300/AUT-310/AUT-320/AUT-330 pages are built; canonical AUT-330 and legacy HEV routes remain distinct')}
module.exports={BATCH,verify}

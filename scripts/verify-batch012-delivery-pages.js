'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const catalog=read('data/curriculum/course-catalog.json')
const lessons=read('data/curriculum/lesson-plans.json')
const arch=read('data/curriculum/program-architecture.json')
const delivery=read('data/curriculum/course-delivery-status.json')
const plan=read('data/curriculum/course-delivery-batch012-plan.json')
const BATCH=['aut-211','aut-250','aut-260','aut-270']
const ROUTES={'aut-211':'/courses/aut-211/','aut-250':'/courses/aut-250-diagnostics/','aut-260':'/courses/aut-260/','aut-270':'/courses/aut-270/'}
function verify(){
 const errors=[]
 const cb=new Map((catalog.courses||[]).map(c=>[c.id,c]))
 const mb=new Map((arch.catalogDevelopmentMappings||[]).map(m=>[m.catalogCourseId,m]))
 const lb=new Map((lessons.lessonPlans||[]).map(l=>[l.id,l]))
 const aligned=new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds||[])
 const overrides=delivery.baseline?.catalogAlignedDedicatedCoursePageRoutes||{}
 if(!['7F-S','7F-T', '7F-U', '7F-V', '7F-W'].includes(delivery.phase)) errors.push('delivery status must be Phase 7F-S or later supported Phase 7F-W')
 if((delivery.baseline?.catalogAlignedDedicatedCoursePageCount||0)<39) errors.push('delivery status must retain at least the 39 Phase 7F-S aligned pages')
 if((delivery.baseline?.catalogCoursesWithoutCatalogAlignedDedicatedPage||0)>29) errors.push('delivery status must not regress above the 29-course Phase 7F-S remaining baseline')
 if(plan.phase!=='7F-S'||plan.status!=='page-built-verified') errors.push('Batch 012 must be page-built-verified in Phase 7F-S')
 if(overrides['aut-250']!=='/courses/aut-250-diagnostics/') errors.push('AUT-250 catalog route override must preserve legacy route collision boundary')
 for(const id of BATCH){
  const c=cb.get(id),m=mb.get(id),l=lb.get(m?.existingLessonPlanId),p=(plan.courses||[]).find(x=>x.courseId===id)
  if(!c){errors.push('catalog course missing: '+id);continue}
  if(!m||m.mappingType!=='canonical-catalog-course'||m.existingCourseId!==id) errors.push('identity-preserving mapping missing: '+id)
  if(!l||l.courseId!==id||l.academicLevel!==c.academicLevel) errors.push('lesson mismatch: '+id)
  if(!p||p.lessonPlanId!==m?.existingLessonPlanId||p.deliveryStatus!=='page-built'||p.deliveryRoute!==ROUTES[id]) errors.push('Batch 012 plan drift: '+id)
  if(p&&p.prerequisiteDisposition!=='requires-human-or-institutional-verification') errors.push('prerequisite boundary drift: '+id)
  const route=ROUTES[id],dir=route.split('/').filter(Boolean)[1]
  const file=path.join(ROOT,'exam-site','courses',dir,'index.html')
  if(!fs.existsSync(file)){errors.push('course page missing: '+id);continue}
  const html=fs.readFileSync(file,'utf8')
  const req=[c.code,c.title,c.description,String(c.credits),c.prerequisites,m.existingLessonPlanId,l?.title,`https://exam.autolearnpro.com${route}`,'INSTRUCTIONAL COURSE PAGE','Eligibility verification required.','does not authorize prerequisite satisfaction, scoring, grading, institutional assessment, or high-stakes use','Any such decision requires separate human or institutional governance.']
  for(const v of req.filter(Boolean)) if(!html.includes(v)&&!html.includes(String(v).replace(/&/g,'&amp;'))) errors.push(id+' page missing: '+v)
  for(const step of l?.sequence||[]) if(!html.includes(step)) errors.push(id+' page missing lesson step: '+step)
  if(!html.includes('<meta name="robots" content="noindex, nofollow">')) errors.push(id+' page must remain noindex,nofollow')
  if(!aligned.has(id)) errors.push('delivery status missing aligned page: '+id)
 }
 const legacy=fs.readFileSync(path.join(ROOT,'exam-site','courses','aut-250','index.html'),'utf8')
 if(!legacy.includes('Hybrid &amp; Electric Vehicle')) errors.push('legacy /courses/aut-250/ HEV package must remain unchanged in identity')
 if(legacy.includes('Automotive Diagnostics I')) errors.push('legacy /courses/aut-250/ must not be relabeled as catalog AUT-250')
 return {ok:errors.length===0,errors,batch:BATCH,routes:ROUTES}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-S Batch 012 delivery pages');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-S Batch 012: AUT-211/AUT-250/AUT-260/AUT-270 pages are built; legacy AUT-250 HEV route remains separate')}
module.exports={BATCH,ROUTES,verify}

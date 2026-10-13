'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const catalog=read('data/curriculum/course-catalog.json')
const arch=read('data/curriculum/program-architecture.json')
const delivery=read('data/curriculum/course-delivery-status.json')
const review=read('data/curriculum/final-eight-governance-review.json')
const eligibility=read('data/curriculum/remaining-delivery-eligibility-audit.json')
const EXPECTED=['aut-400','aut-420','aut-450','aut-451','aut-620','aut-630','aut-640','aut-690']
function verify(){
 const errors=[]
 const cb=new Map((catalog.courses||[]).map(c=>[c.id,c]))
 const mb=new Map((arch.catalogDevelopmentMappings||[]).map(m=>[m.catalogCourseId,m]))
 const built=new Set(delivery.baseline?.catalogAlignedDedicatedCoursePageIds||[])
 if(review.phase!=='7F-ZA') errors.push('review phase must be 7F-ZA')
 if(review.sourceDeliveryPhase!=='7F-Z') errors.push('review source delivery phase must remain 7F-Z')
 if(review.status!=='review-complete') errors.push('review status must be review-complete')
 if(JSON.stringify((review.records||[]).map(r=>r.courseId))!==JSON.stringify(EXPECTED)) errors.push('review must cover the exact final eight courses')
 if(review.summary?.remainingCatalogCourses!==8) errors.push('final review must cover 8 remaining catalog courses')
 if(review.summary?.automaticDeliveryEligible!==0) errors.push('automatic delivery eligible count must remain zero')
 if(review.summary?.coursesWithHumanInstitutionalBlockers!==7) errors.push('human/institutional blocker coverage must be 7 courses')
 if(review.summary?.coursesWithPrerequisiteChainBlockers!==2) errors.push('prerequisite-chain blocker coverage must be 2 courses')
 if(review.summary?.coursesWithMultipleBlockerTypes!==1) errors.push('exactly one course must have multiple blocker types')
 if(review.summary?.canonicalMappingBlocked!==0) errors.push('canonical mapping blockers must remain zero')
 if(review.boundaries?.createsBatch019!==false) errors.push('review must not create Batch 019')
 if(review.conclusion?.batch019Ready!==false) errors.push('Batch 019 must remain blocked')
 if(JSON.stringify(review.conclusion?.batch019Candidates||[])!==JSON.stringify([])) errors.push('Batch 019 candidates must remain empty')
 if(eligibility.conclusion?.batch019Ready!==false) errors.push('eligibility audit must also keep Batch 019 blocked')
 if(JSON.stringify(eligibility.conclusion?.batch019Candidates||[])!==JSON.stringify([])) errors.push('eligibility audit Batch 019 candidates must remain empty')
 if((eligibility.records||[]).length!==8) errors.push('eligibility audit must still cover the final eight courses')
 for(const r of review.records||[]){
  const c=cb.get(r.courseId),m=mb.get(r.courseId)
  if(!c){errors.push('catalog course missing: '+r.courseId);continue}
  if(!m||m.mappingType!=='canonical-catalog-course'||m.existingCourseId!==r.courseId) errors.push('canonical mapping drift: '+r.courseId)
  if(r.prerequisitesText!==c.prerequisites) errors.push('prerequisite text drift: '+r.courseId)
  if(r.catalogAlignedDeliveryPageBuilt!==built.has(r.courseId)) errors.push('delivery flag drift: '+r.courseId)
  if(r.automaticDeliveryEligible!==false) errors.push('automatic delivery eligibility must remain false: '+r.courseId)
  if(!Array.isArray(r.blockers)||r.blockers.length===0) errors.push('blocker list missing: '+r.courseId)
 }
 const aut450=(review.records||[]).find(r=>r.courseId==='aut-450')
 if(!aut450||!aut450.blockers.some(b=>b.type==='prerequisite-chain')||!aut450.blockers.some(b=>b.type==='human-institutional')) errors.push('AUT-450 dual blocker state must remain explicit')
 const aut451=(review.records||[]).find(r=>r.courseId==='aut-451')
 if(!aut451||aut451.blockers.length!==1||aut451.blockers[0].type!=='prerequisite-chain') errors.push('AUT-451 must remain pure downstream chain blocker')
 return {ok:errors.length===0,errors,summary:review.summary,conclusion:review.conclusion}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-ZA final-eight governance review');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-ZA final-eight governance review: 8 remaining, 0 automatic delivery candidates, 7 human/institutional, 2 chain, 1 dual-blocked')}
module.exports={verify}

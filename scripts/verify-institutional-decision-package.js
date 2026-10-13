'use strict'
const fs=require('fs'),path=require('path')
const ROOT=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))
const pkg=read('data/curriculum/institutional-decision-package-final-eight.json')
const review=read('data/curriculum/final-eight-governance-review.json')
const eligibility=read('data/curriculum/remaining-delivery-eligibility-audit.json')
const worksheet=fs.readFileSync(path.join(ROOT,'docs/institutional-submission/Final-Eight-Institutional-Decision-Worksheet.md'),'utf8')
const IDS=['aut-400','aut-420','aut-450','aut-451','aut-620','aut-630','aut-640','aut-690']
function verify(){
 const errors=[]
 if(pkg.phase!=='7F-ZB') errors.push('decision package phase must be 7F-ZB')
 if(pkg.sourceGovernancePhase!=='7F-ZA') errors.push('source governance phase must be 7F-ZA')
 if(pkg.status!=='prepared-for-external-human-review') errors.push('package status drift')
 if(pkg.defaults?.decisionState!=='pending-institutional-review') errors.push('default decision state must remain pending')
 if(pkg.defaults?.automaticApprovalAllowed!==false) errors.push('automatic approval must remain false')
 if(pkg.defaults?.softwareMayInferDecision!==false) errors.push('software inference must remain false')
 if(pkg.defaults?.blankDecisionDoesNotUnlockDelivery!==true) errors.push('blank decisions must not unlock delivery')
 if(JSON.stringify((pkg.decisions||[]).map(d=>d.courseId))!==JSON.stringify(IDS)) errors.push('package must contain exact final eight')
 if((review.records||[]).length!==8) errors.push('source review must remain final eight')
 if(eligibility.conclusion?.batch019Ready!==false) errors.push('Batch 019 must remain closed')
 for(const d of pkg.decisions||[]){
   if(d.decisionState!=='pending-institutional-review') errors.push('decision must default pending: '+d.courseId)
   if(d.reviewerRecord?.decisionState!=='pending-institutional-review') errors.push('reviewer record must default pending: '+d.courseId)
   if(d.downstreamEffect?.automaticDeliveryUnlock!==false) errors.push('automatic unlock must be false: '+d.courseId)
   if(d.downstreamEffect?.requiresGovernanceRecordUpdate!==true) errors.push('governance update required: '+d.courseId)
   if(d.downstreamEffect?.requiresDeterministicReaudit!==true) errors.push('deterministic reaudit required: '+d.courseId)
   if(d.downstreamEffect?.assessmentEligibilityChange!==false) errors.push('assessment eligibility must remain unchanged: '+d.courseId)
   const src=review.records.find(r=>r.courseId===d.courseId)
   if(!src) errors.push('missing source governance record: '+d.courseId)
   else if(d.prerequisitesText!==src.prerequisitesText) errors.push('prerequisite drift: '+d.courseId)
 }
 for(const code of ['AUT 400','AUT 420','AUT 450','AUT 451','AUT 620','AUT 630','AUT 640','AUT 690']) if(!worksheet.includes('Decision record — '+code)) errors.push('worksheet missing '+code)
 if(!worksheet.replace(/\*\*/g,'').includes('does not automatically create a new delivery page')) errors.push('worksheet must preserve post-decision governance boundary')
 return {ok:errors.length===0,errors,decisionCount:(pkg.decisions||[]).length,status:pkg.status}
}
if(require.main===module){const r=verify();if(!r.ok){console.error('[FAIL] Phase 7F-ZB institutional decision package');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 7F-ZB institutional decision package: 8 pending decisions, no automatic approval/unlock, Batch 019 closed')}
module.exports={verify}

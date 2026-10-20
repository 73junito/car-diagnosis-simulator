'use strict';
const catalog=require('../data/curriculum/aut250-obd-question-blueprints.json');
const assumption=require('../data/curriculum/aut250-outcome-alignment-matrix.json');
const theory=require('../data/curriculum/aut250-theoretical-measurements-outcome.json');
const ids=new Set([assumption.outcome.id,theory.outcome.id]);
function validate(data=catalog){
 const errors=[],seen=new Set();
 if(data.status!=='developmental_formative_only'||Object.values(data.review||{}).some(Boolean))errors.push('authority_not_closed');
 if(data.courseId!==assumption.courseId||data.competencyId!==assumption.competencyMapping.id)errors.push('course_alignment_invalid');
 for(const id of data.learningOutcomeIds||[])if(!ids.has(id))errors.push('unknown_outcome:'+id);
 for(const [i,q] of (data.questions||[]).entries()){
  if(!q.id||seen.has(q.id))errors.push('duplicate_or_missing_id:'+i);seen.add(q.id);
  if(!['OBD_I','OBD_II'].includes(q.protocol)||!['remember','understand','apply','analyze','evaluate','create'].includes(q.bloom))errors.push('classification_invalid:'+i);
  if(!q.stem||!q.rationale||q.technicalStatus!=='pending_sme'||q.assessmentEligible!==false)errors.push('evidence_review_invalid:'+i);
  if(q.type==='single_choice'){
   if(!Array.isArray(q.choices)||q.choices.length<3||new Set(q.choices.map(x=>x.id)).size!==q.choices.length||q.choices.filter(x=>x.id===q.correctChoiceId).length!==1)errors.push('choices_invalid:'+i);
  }else if(q.type==='written_reasoning'){if(!Array.isArray(q.expectedEvidence)||!q.expectedEvidence.length)errors.push('reasoning_evidence_missing:'+i);}
  else errors.push('type_invalid:'+i);
  for(const ref of q.sourceContext||[])if(!ref.documentId||!Number.isInteger(ref.page)||ref.page<1)errors.push('source_locator_invalid:'+i);
 }
 return {valid:errors.length===0,errors,assessmentEligible:false};
}
module.exports={validate};
if(require.main===module){const r=validate();console.log(JSON.stringify(r,null,2));if(!r.valid)process.exitCode=1;}

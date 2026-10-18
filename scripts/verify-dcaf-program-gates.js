'use strict';
const fs=require('node:fs');const path=require('node:path');
function verify(p){
 if(p?.schema_version!=='1.0'||p?.assessment_use!=='formative_only'||p.scientific_validation_claim!==false||p.institutional_approval_claim!==false||p.high_stakes_eligible!==false)throw Error('Invalid or unsafe program claims');
 const c=p.controls||{};for(const k of ['requires_instructor_review','privacy_review_required_before_pilot'])if(c[k]!==true)throw Error('Missing '+k);
 for(const k of ['automatic_progression','student_grading_enabled','raw_event_mutation_allowed','score_gate_enabled'])if(c[k]!==false)throw Error('Unsafe '+k);
 const rubric=p.rubric;if(rubric?.status!=='illustrative_not_validated'||rubric?.total_weight!==100||!Array.isArray(rubric.dimensions)||rubric.dimensions.reduce((sum,d)=>sum+d.weight,0)!==100)throw Error('Invalid rubric');
 const ids=new Set(),stages=p.stages;if(!Array.isArray(stages)||stages.length!==6)throw Error('Missing stage coverage');
 for(const s of stages){if(!/^R[0-5]$/.test(s.id)||ids.has(s.id)||!['planned','blocked','under_review','approved'].includes(s.status)||!Array.isArray(s.required_evidence)||s.required_evidence.length<2||!Array.isArray(s.approval_roles)||!s.approval_roles.length)throw Error('Malformed stage');ids.add(s.id)}
 for(const s of stages){for(const dep of s.depends_on||[])if(!ids.has(dep)||Number(dep.slice(1))>=Number(s.id.slice(1)))throw Error('Invalid stage dependency');if(s.status==='approved')throw Error('Approvals require external signed evidence, not repo status')}
 if(stages.find(s=>s.id==='R3')?.required_evidence.includes('research_approval_or_IRB_determination')!==true)throw Error('Missing research ethics gate');
 if(stages.find(s=>s.id==='R4')?.required_evidence.includes('partner_written_agreement')!==true)throw Error('Missing institutional pilot agreement');
 return {status:'PASS',stage_count:stages.length,score_use:p.assessment_use,high_stakes_eligible:false};
}
if(require.main===module){try{const f=process.argv[2]||path.resolve(__dirname,'../docs/institutional-readiness/dcaf-program-gates.json');console.log(JSON.stringify(verify(JSON.parse(fs.readFileSync(f,'utf8')))))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={verify};

'use strict';
const crypto=require('node:crypto');
const kinds=new Set(['scenario_started','hypothesis_recorded','test_requested','measurement_observed','diagnosis_submitted','repair_selected','repair_verification_requested','session_ended']);
const id=/^[A-Za-z0-9_-]{8,64}$/;
const digest=events=>crypto.createHash('sha256').update(JSON.stringify(events)).digest('hex');
function validate(document){
 const errors=[];
 if(!document||typeof document!=='object'||Array.isArray(document))return {valid:false,errors:['invalid_document']};
 if(document.status!=='formative_prototype_unvalidated'||document.assessment_eligible!==false)errors.push('prohibited_assessment_claim');
 if(!id.test(document.session_id||'')||!document.scenario||typeof document.scenario.id!=='string'||typeof document.scenario.version!=='string')errors.push('missing_identity');
 if(document.scenario?.assessment_eligible!==false||document.scenario?.validated!==false)errors.push('unverified_scenario_claim');
 if(!Array.isArray(document.events)||document.events.length>10000)return {valid:false,errors:[...errors,'invalid_events']};
 let ended=false,priorTime=null,previous=null,pending=null;
 document.events.forEach((e,i)=>{
  if(!e||e.schema_version!=='1.0'||e.scenario_id!==document.scenario?.id||e.scenario_version!==document.scenario?.version||e.session_id!==document.session_id||e.sequence!==i+1||!kinds.has(e.kind)||!e.payload||typeof e.payload!=='object'||Array.isArray(e.payload))errors.push('event_invalid_'+(i+1));
  const t=Date.parse(e?.timestamp);if(!Number.isFinite(t)||new Date(t).toISOString()!==e?.timestamp||priorTime!==null&&t<priorTime)errors.push('timestamp_invalid_'+(i+1));priorTime=t;
  if(ended)errors.push('event_after_session_end');
  if(e?.kind==='session_ended')ended=true;
  if(e?.kind==='measurement_observed'){
   if(e.payload.simulated!==true||typeof e.payload.test_id!=='string'||typeof e.payload.instrument!=='string'||!e.payload.result||typeof e.payload.result!=='object'||!pending||pending.test_id!==e.payload.test_id||pending.instrument!==e.payload.instrument)errors.push('measurement_provenance_invalid_'+(i+1));
   pending=null;
  }else if(e?.kind==='test_requested'){
   if(pending)errors.push('unpaired_test_request');
   pending={test_id:e.payload.test_id,instrument:e.payload.instrument};
  }else if(pending)errors.push('unpaired_test_request');
  previous=e;
 });
 if(pending)errors.push('unpaired_test_request');
 if(!/^[a-f0-9]{64}$/.test(document.integrity_sha256||'')||digest(document.events)!==document.integrity_sha256)errors.push('checksum_mismatch');
 return {valid:errors.length===0,errors};
}
module.exports={validate,digest,kinds};

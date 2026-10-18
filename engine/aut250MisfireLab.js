'use strict';
// R1 prototype: deterministic *simulated* measurements, not OEM specifications.
// No storage, scoring, grading, assessment eligibility, or network access.
const crypto=require('node:crypto');
const SCENARIO=Object.freeze({id:'AUT250-MISFIRE-CYL2-R1',version:'0.1.0',course:'AUT-250',
 fault:'intermittent_cylinder_2_ignition_coil_primary_open',
 status:'technical_review_pending',validated:false,assessment_eligible:false,
 complaint:'Rough running during acceleration; MIL illuminated',
 operating_condition:'warm_engine_under_load',dtc:'P0302',
 instruments:['scan_tool','dvom','oscilloscope'],review:'Requires independent automotive SME review before instructional use.'});
const TESTS=Object.freeze({
 read_dtc:{instrument:'scan_tool',result:{codes:['P0302'],freeze_frame:{rpm:2400,load_pct:68,coolant_c:89}},units:null},
 inspect_fuel_trim:{instrument:'scan_tool',result:{short_term_pct:2,long_term_pct:3},units:'percent'},
 measure_coil_supply:{instrument:'dvom',result:{voltage_v:13.8},units:'V'},
 scope_coil_primary_2:{instrument:'oscilloscope',result:{pattern:'intermittent_missing_primary_current_ramp',comparison:'cylinder_1_normal'},units:null},
 scope_coil_primary_1:{instrument:'oscilloscope',result:{pattern:'normal_primary_current_ramp'},units:null},
 verify_after_coil_replacement:{instrument:'scan_tool',result:{misfire_counter_cyl2:0,mil:'off',drive_cycle:'simulated_pass'},units:null}
});
const ALLOWED=new Set(['scenario_started','hypothesis_recorded','test_requested','measurement_observed','diagnosis_submitted','repair_selected','repair_verification_requested','session_ended']);
function session({sessionId,studentAlias,clock=()=>new Date().toISOString()}){
 if(!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)||typeof studentAlias!=='string'||studentAlias.length<1||studentAlias.length>64)throw Error('Invalid pseudonymous session identifiers');
 const events=[];let sequence=0,closed=false,repaired=false;
 function record(kind,payload={}){
  if(closed||!ALLOWED.has(kind)||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid event');
  if(kind==='measurement_observed')throw Error('Measurements must originate from simulation');
  const event={schema_version:'1.0',scenario_id:SCENARIO.id,scenario_version:SCENARIO.version,session_id:sessionId,sequence:++sequence,timestamp:clock(),kind,payload:JSON.parse(JSON.stringify(payload))};
  events.push(Object.freeze(event));if(kind==='session_ended')closed=true;return JSON.parse(JSON.stringify(event));
 }
 function test(testId,instrument){
  if(closed||!Object.hasOwn(TESTS,testId)||TESTS[testId].instrument!==instrument)throw Error('Unsupported test/instrument');
  if(testId==='verify_after_coil_replacement'&&!repaired)throw Error('Repair verification unavailable before repair');
  record('test_requested',{test_id:testId,instrument});
  const result=JSON.parse(JSON.stringify(TESTS[testId].result));
  const event={schema_version:'1.0',scenario_id:SCENARIO.id,scenario_version:SCENARIO.version,session_id:sessionId,sequence:++sequence,timestamp:clock(),kind:'measurement_observed',payload:{test_id:testId,instrument,simulated:true,result}};
  events.push(Object.freeze(event));return JSON.parse(JSON.stringify(event));
 }
 function repair(component){if(component!=='cylinder_2_ignition_coil')throw Error('Unsupported simulation repair');record('repair_selected',{component});repaired=true}
 function exportEvidence(){const data={status:'formative_prototype_unvalidated',assessment_eligible:false,scenario:{...SCENARIO},session_id:sessionId,student_alias:studentAlias,events:events.map(e=>JSON.parse(JSON.stringify(e)))};data.integrity_sha256=crypto.createHash('sha256').update(JSON.stringify(data.events)).digest('hex');return data}
 return Object.freeze({record,test,repair,exportEvidence});
}
module.exports={SCENARIO,TESTS,session};

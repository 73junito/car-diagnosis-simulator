'use strict';
const {SCENARIO,TESTS}=require('../../engine/aut250MisfireLab');
const {validate}=require('../diagnostic-evidence/validate');
const CONTRACT_VERSION='1.0.0';
const REQUIRED_TESTS=Object.freeze({
 read_dtc:'scan_tool',inspect_fuel_trim:'scan_tool',measure_coil_supply:'dvom',
 scope_coil_primary_2:'oscilloscope',scope_coil_primary_1:'oscilloscope',
 verify_after_coil_replacement:'scan_tool'
});
const ENGINE_REPAIR='cylinder_2_ignition_coil';
const REVIEW_STATUS='technical_review_pending';
function checkCompatibility(){
 const problems=[];
 if(SCENARIO.id!=='AUT250-MISFIRE-CYL2-R1'||SCENARIO.fault!=='intermittent_cylinder_2_ignition_coil_primary_open'||SCENARIO.dtc!=='P0302')problems.push('engine_scenario_changed');
 if(SCENARIO.validated!==false||SCENARIO.assessment_eligible!==false||SCENARIO.status!==REVIEW_STATUS)problems.push('engine_authority_changed');
 for(const [name,instrument] of Object.entries(REQUIRED_TESTS))if(TESTS[name]?.instrument!==instrument)problems.push('engine_test_changed:'+name);
 if(TESTS.read_dtc?.result?.codes?.[0]!=='P0302'||TESTS.scope_coil_primary_2?.result?.pattern!=='intermittent_missing_primary_current_ramp')problems.push('engine_measurement_changed');
 return {compatible:problems.length===0,problems};
}
function evaluateEvidence(exported){
 const match=checkCompatibility();
 const validation=validate(exported);
 return {ready_for_formative_review:match.compatible&&validation.valid,
  ready_for_grading:false,approved_for_university_pilot:false,
  compatibility:match,evidence:validation};
}
module.exports={CONTRACT_VERSION,REQUIRED_TESTS,ENGINE_REPAIR,REVIEW_STATUS,checkCompatibility,evaluateEvidence};

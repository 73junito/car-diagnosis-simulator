'use strict';
const test=globalThis.test || require('node:test'),assert=require('node:assert/strict');
const {SCENARIO,TESTS,session}=require('../engine/aut250MisfireLab');
const make=()=>session({sessionId:'student-001',studentAlias:'learner-1',clock:()=> '2026-10-17T00:00:00.000Z'});
function prepare(s){
 s.record('scenario_started');
 s.record('hypothesis_recorded',{cause:'ignition primary or upstream circuit'});
 for(const id of ['read_dtc','measure_coil_supply','scope_coil_primary_2','scope_coil_driver_command','inspect_coil_connector','inspect_harness_continuity'])s.test(id,TESTS[id].instrument);
 s.record('diagnosis_submitted',{reasoning:'Provisional simulated decision after reviewing control, supply, wiring and coil; needs instructor review'});
}
test('deterministic simulation and ordered evidence remain intact',()=>{
 const a=make(),b=make();
 for(const s of [a,b]){prepare(s);s.repair('cylinder_2_ignition_coil');s.test('verify_after_coil_replacement','scan_tool');s.record('session_ended')}
 assert.deepEqual(a.exportEvidence(),b.exportEvidence());
 assert.equal(a.exportEvidence().events.length,19);
});
test('unsupported instruments and premature verification are refused',()=>{
 const s=make();assert.throws(()=>s.test('read_dtc','dvom'));assert.throws(()=>s.test('made_up','scan_tool'));assert.throws(()=>s.test('verify_after_coil_replacement','scan_tool'));assert.throws(()=>s.record('measurement_observed',{fake:true}));
});
test('missing discriminating evidence blocks repair without recording repair success',()=>{
 const s=make();s.test('scope_coil_primary_2','oscilloscope');s.record('diagnosis_submitted',{reasoning:'coil assumed'});
 assert.throws(()=>s.repair('cylinder_2_ignition_coil'),/Diagnostic evidence incomplete/);
 assert.equal(s.exportEvidence().events.some(e=>e.kind==='repair_selected'),false);
});
test('incomplete written reasoning blocks repair despite all checks',()=>{
 const s=make();for(const id of ['read_dtc','measure_coil_supply','scope_coil_primary_2','scope_coil_driver_command','inspect_coil_connector','inspect_harness_continuity'])s.test(id,TESTS[id].instrument);
 s.record('diagnosis_submitted',{reasoning:' '});
 assert.throws(()=>s.repair('cylinder_2_ignition_coil'),/Reasoned diagnosis required/);
});
test('review-only qualitative signals describe limitations instead of confirmed fault location',()=>{
 assert.match(TESTS.inspect_harness_continuity.result.limitations,/cannot_exclude/);
 assert.match(TESTS.scope_coil_driver_command.result.limitations,/does_not_prove/);
 assert.equal(SCENARIO.validated,false);assert.equal(SCENARIO.assessment_eligible,false);
});
test('evidence copied and closed sessions cannot mutate',()=>{
 const s=make();s.test('measure_coil_supply','dvom');const evidence=s.exportEvidence();evidence.events[0].payload.test_id='tampered';assert.equal(s.exportEvidence().events[0].payload.test_id,'measure_coil_supply');s.record('session_ended');assert.throws(()=>s.repair('cylinder_2_ignition_coil'));assert.equal(evidence.assessment_eligible,false);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SCENARIO,session}=require('../engine/aut250MisfireLab');
const make=()=>session({sessionId:'student-001',studentAlias:'learner-1',clock:()=> '2026-10-17T00:00:00.000Z'});
test('same actions produce deterministic simulated results and event sequence',()=>{
 const a=make(),b=make();for(const s of [a,b]){s.record('scenario_started');s.record('hypothesis_recorded',{cause:'ignition'});s.test('read_dtc','scan_tool');s.test('scope_coil_primary_2','oscilloscope');s.repair('cylinder_2_ignition_coil');s.test('verify_after_coil_replacement','scan_tool');s.record('session_ended')}
 assert.deepEqual(a.exportEvidence(),b.exportEvidence());assert.equal(a.exportEvidence().events.length,10);
});
test('unsupported instruments, tests, and premature verification are refused',()=>{
 const s=make();assert.throws(()=>s.test('read_dtc','dvom'));assert.throws(()=>s.test('made_up','scan_tool'));assert.throws(()=>s.test('verify_after_coil_replacement','scan_tool'));assert.throws(()=>s.record('measurement_observed',{fake:true}));
});
test('formative only, evidence copied, and closed sessions cannot mutate',()=>{
 const s=make();s.test('measure_coil_supply','dvom');const evidence=s.exportEvidence();evidence.events[0].payload.test_id='tampered';assert.equal(s.exportEvidence().events[0].payload.test_id,'measure_coil_supply');s.record('session_ended');assert.throws(()=>s.repair('cylinder_2_ignition_coil'));assert.equal(SCENARIO.validated,false);assert.equal(evidence.assessment_eligible,false);
});

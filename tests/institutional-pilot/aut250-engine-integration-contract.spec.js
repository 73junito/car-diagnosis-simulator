'use strict';
const {SCENARIO,session}=require('../../engine/aut250MisfireLab');
const {CONTRACT_VERSION,checkCompatibility,evaluateEvidence,ENGINE_REPAIR,REQUIRED_TESTS}=require('../../contracts/aut250-engine-integration/contract');
const make=()=>session({sessionId:'student-001',studentAlias:'learner-1',clock:()=> '2026-10-17T00:00:00.000Z'});
test('contract fixes R1 cylinder-2 primary fault identity and instrument mappings',()=>{
 expect(CONTRACT_VERSION).toBe('1.0.0');
 expect(checkCompatibility()).toEqual({compatible:true,problems:[]});
 expect(REQUIRED_TESTS.scope_coil_primary_2).toBe('oscilloscope');
 expect(SCENARIO.dtc).toBe('P0302');
});
test('native engine evidence passes integrity validation but never authorizes grading',()=>{
 const s=make();s.record('scenario_started');s.record('hypothesis_recorded',{cause:'coil'});for(const [id,instrument] of Object.entries({...REQUIRED_TESTS,scope_coil_driver_command:'oscilloscope',inspect_coil_connector:'dvom',inspect_harness_continuity:'dvom'})){if(id!=='verify_after_coil_replacement')s.test(id,instrument)}s.record('diagnosis_submitted',{reasoning:'Provisional differential diagnosis; requires SME review'});s.repair(ENGINE_REPAIR);s.test('verify_after_coil_replacement','scan_tool');s.record('session_ended');
 const check=evaluateEvidence(s.exportEvidence());
 expect(check.ready_for_formative_review).toBe(true);
 expect(check.ready_for_grading).toBe(false);
 expect(check.approved_for_university_pilot).toBe(false);
});
test('rejects mock UI evidence rather than silently mapping cylinder-3 observations',()=>{
 const {createAut250MockAdapter}=require('../../dashboard/student/aut250-lab-ui/aut250-mock-adapter');
 const mock=createAut250MockAdapter({now:()=> '2026-10-17T00:00:00.000Z',makeId:()=> 'SIM-MOCK-01'});
 mock.session();mock.test('scan-tool-dtc');const check=evaluateEvidence(mock.exportEvidence());
 expect(check.ready_for_formative_review).toBe(false);
 expect(check.evidence.valid).toBe(false);
});
test('rejects corrupt engine export without changing grading authority',()=>{
 const s=make();s.record('scenario_started');const e=s.exportEvidence();
 e.events[0].payload={tampered:true};
 const check=evaluateEvidence(e);
 expect(check.ready_for_formative_review).toBe(false);
 expect(check.evidence.errors).toContain('checksum_mismatch');
 expect(check.ready_for_grading).toBe(false);
});
test('engine requires instrument, approved repair and separate verification',()=>{
 const s=make();
 expect(()=>s.test('read_dtc','dvom')).toThrow();
 expect(()=>s.test('verify_after_coil_replacement','scan_tool')).toThrow();
 expect(()=>s.repair('replace-ignition-coil-cylinder-3')).toThrow();
});

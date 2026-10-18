'use strict';
const table=require('../data/curriculum/aut250-ignition-truth-table.json');
const {SCENARIO,TESTS}=require('../engine/aut250MisfireLab');
test('truth table explicitly remains developmental with release gates closed',()=>{
 expect(table.validated).toBe(false);expect(table.assessmentEligible).toBe(false);
 expect(Object.values(table.releaseGates).every(x=>x===false)).toBe(true);
 expect(table.scenarioId).not.toBe(SCENARIO.id);
});
test('every diagnostic check describes all three comparable states and an instrument',()=>{
 expect(table.checks.length).toBeGreaterThanOrEqual(8);
 const ids=new Set();
 for(const row of table.checks){expect(ids.has(row.id)).toBe(false);ids.add(row.id);for(const key of [...table.states,'instrument'])expect(typeof row[key]).toBe('string');}
 expect(table.states).toEqual(['normal','fault_active','post_repair']);
});
test('direct internal-fault and external-circuit discrimination evidence is separate',()=>{
 const isolate=table.checks.find(r=>r.id==='isolated_primary_continuity');
 const harness=table.checks.find(r=>r.id==='harness_fault_reproduction');
 expect(isolate.discriminates).toBe(true);expect(harness.discriminates).toBe(true);
 expect(isolate.fault_active).toMatch(/isolated primary terminals/);
});
test('current R1 misclassifications remain documented, not silently approved',()=>{
 expect(TESTS.inspect_coil_connector.instrument).toBe('dvom');
 expect(table.checks.find(r=>r.id==='connector_visual').instrument).toBe('visual_inspection');
 expect(table.releaseGates.scenario_versioned_in_engine).toBe(false);
});
test('no invented threshold or approved assessment outcome',()=>{
 const txt=JSON.stringify(table);
 expect(txt).not.toMatch(/"approved_for_pilot":true|"assessmentEligible":true/);
 expect(table.constraints.some(x=>/No numeric specification/.test(x))).toBe(true);
});

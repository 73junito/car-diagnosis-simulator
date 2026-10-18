'use strict';
const r=require('../data/curriculum/aut250-r2-integration-readiness.json');
const truth=require('../data/curriculum/aut250-ignition-truth-table.json');
const matrix=require('../data/curriculum/aut250-outcome-alignment-matrix.json');
const {SCENARIO}=require('../engine/aut250MisfireLab');
test('integration design retains unapproved gates and forbids authority creep',()=>{
 expect(r.state).toBe('design_only');
 expect(Object.values(r.integrationGates).every(v=>v===false)).toBe(true);
 expect(r.forbidden).toContain('no automatic grading');
});
test('design references existing truth and curriculum identities',()=>{
 expect(truth.scenarioId).toBe('AUT250-MISFIRE-CYL2-R2-PROPOSED');
 expect(matrix.courseId).toBe('aut-250');
 expect(r.gaps.length).toBeGreaterThanOrEqual(7);
});
test('R1 engine and proposed R2 remain separate',()=>{
 expect(SCENARIO.id).toBe('AUT250-MISFIRE-CYL2-R1');
 expect(r.gaps.find(g=>g.id==='scenario_identity').required).toMatch(/cylinder-2/);
 expect(truth.validated).toBe(false);
});
test('no fabricated plots or grade authorization permitted',()=>{
 expect(r.forbidden.some(x=>x.includes('waveforms'))).toBe(true);
 expect(r.integrationGates.assessmentAuthorized).toBe(false);
});

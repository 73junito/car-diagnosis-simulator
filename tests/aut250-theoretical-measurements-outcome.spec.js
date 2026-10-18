'use strict';
const t=require('../data/curriculum/aut250-theoretical-measurements-outcome.json');
const m=require('../data/curriculum/aut250-outcome-alignment-matrix.json');
test('adds a distinct complementary outcome without overwriting prior one',()=>{
 expect(t.courseId).toBe(m.courseId);
 expect(t.competencyId).toBe(m.competencyMapping.id);
 expect(t.outcome.id).not.toBe(m.outcome.id);
 expect(t.outcome.bloomLevels).toEqual(['apply','analyze','evaluate']);
});
test('worked resistive model uses correct units and honest missing measurements',()=>{
 const a=t.activities.find(a=>a.id==='ideal-resistive-dc');
 expect(a.predicted.current_a).toBe(a.inputs.voltage_v/a.inputs.resistance_ohm);
 expect(a.predicted.power_w).toBe(a.inputs.voltage_v*a.predicted.current_a);
 expect(a.measurementStatus).toBe('not_supplied');
 expect(a.oemStatus).toBe('not_supplied');
});
test('ignition transient does not masquerade as steady-state calculation',()=>{
 const a=t.activities.find(a=>a.id==='ignition-primary-rl');
 expect(a.status).toBe('calculation_pending_review');
 expect(a.numericOutput).toBeNull();
});
test('assessable evidence chain and authority restrictions',()=>{
 expect(t.evidenceCriteria.length).toBeGreaterThanOrEqual(6);
 for(const x of t.evidenceCriteria)expect(x.artifact&&x.criterion).toBeTruthy();
 expect(Object.values(t.safeguards).every(x=>x===false)).toBe(true);
});

const { getGraph, getCauses } = require('../../core/diagnosis/graphModel');

test('getCauses returns causes for known symptom', () => {
  const causes = getCauses('misfire');
  expect(Array.isArray(causes)).toBe(true);
  expect(causes).toEqual(expect.arrayContaining(['spark_plug_fault', 'ignition_coil_failure']));
});

test('getCauses returns empty array for unknown symptom', () => {
  const causes = getCauses('unknown-symptom-xyz');
  expect(Array.isArray(causes)).toBe(true);
  expect(causes.length).toBe(0);
});

test('getGraph returns stable structure', () => {
  const g = getGraph();
  expect(g).toHaveProperty('overheating');
  expect(g.overheating.causes).toEqual(expect.arrayContaining(['coolant_leak']));
});

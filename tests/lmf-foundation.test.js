const fs = require('fs');
const path = require('path');
const { validateFoundation, collectLegacyCircuitFaultTypes } = require('../scripts/verify-lmf-foundation');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'lmf', name), 'utf8'));

describe('LMF-1 through LMF-6 foundation', () => {
  test('cross-registry validator passes', () => {
    expect(() => validateFoundation()).not.toThrow();
  });

  test('LMF-1 registers seven existing and ten planned workspaces', () => {
    const registry = read('lab-registry.json');
    expect(registry.labs).toHaveLength(17);
    expect(registry.labs.filter((lab) => lab.lifecycle === 'existing')).toHaveLength(7);
    expect(registry.labs.filter((lab) => lab.lifecycle === 'planned')).toHaveLength(10);
  });

  test('LMF-2 uses stable scenario keys and keeps routing non-authoritative', () => {
    const contract = read('scenario-lab-mappings.json');
    expect(contract.rules.scenarioProvidesInstructionalContextOnly).toBe(true);
    expect(contract.rules.mappingMayDefineEngineeringBehavior).toBe(false);
    expect(contract.rules.mappingMayGrantAssessmentEligibility).toBe(false);
    expect(contract.rules.mappingMayGrantPublication).toBe(false);
    expect(contract.selectorPolicy.symptomCategoriesAreNotRoutingIdentifiers).toBe(true);
    for (const mapping of contract.mappings) {
      expect(mapping.selector.kind).toBe('scenario-key');
      expect(mapping).not.toHaveProperty('scenarioId');
      expect(mapping).not.toHaveProperty('symptomCategory');
    }
    expect(contract.mappings.some((mapping) => mapping.selector.value === 'no-crank')).toBe(false);
    expect(contract.mappings.some((mapping) => mapping.selector.value === 'no-crank-clicking')).toBe(true);
    expect(contract.mappings.some((mapping) => mapping.selector.value === 'no-crank-starter-click')).toBe(true);
    expect(contract.unmappedSelectors).toEqual(expect.arrayContaining([
      expect.objectContaining({ selector: { kind: 'scenario-key', value: 'power-loss' } })
    ]));
  });

  test('LMF-3 requires model/state input and prohibits assessment/publication outputs', () => {
    const registry = read('engineering-model-adapters.json');
    expect(registry.interface.requiredInputs).toEqual(expect.arrayContaining(['modelRef', 'operatingStateId']));
    expect(registry.interface.prohibitedOutputs).toEqual(expect.arrayContaining([
      'correctAnswer',
      'score',
      'assessmentEligible',
      'publicationApproved'
    ]));
  });

  test('LMF-4 diagnostic tools never own engineering or assessment authority', () => {
    const registry = read('diagnostic-tools.json');
    for (const tool of registry.tools) {
      expect(tool.engineeringAuthority).toBe(false);
      expect(tool.assessmentAuthority).toBe(false);
    }
  });

  test('LMF-5 measurement records cannot contain scoring, conclusion, or publication authority', () => {
    const contract = read('measurement-contract.json');
    expect(contract.recordShape.prohibited).toEqual(expect.arrayContaining([
      'correctAnswer',
      'score',
      'points',
      'assessmentEligible',
      'publicationApproved',
      'diagnosticConclusion'
    ]));
  });

  test('LMF-6 covers every legacy circuit fault type without moving behavior into taxonomy', () => {
    const taxonomy = read('fault-taxonomy.json');
    const mapped = new Set(taxonomy.legacyMappings.map((entry) => entry.legacyType));
    for (const legacyType of collectLegacyCircuitFaultTypes()) {
      expect(mapped.has(legacyType)).toBe(true);
    }
    expect(taxonomy.invariant).toMatch(/does not create engineering behavior/i);
  });

  test('planned workspaces do not expose production routes', () => {
    const registry = read('lab-registry.json');
    for (const lab of registry.labs.filter((entry) => entry.lifecycle === 'planned')) {
      expect(lab.route).toBeNull();
      expect(lab.directPracticeAllowed).toBe(false);
    }
  });

  test('LMF governance contracts are excluded from the static production bundle', () => {
    const buildScript = fs.readFileSync(path.join(ROOT, 'scripts', 'build-static-site.js'), 'utf8');
    expect(buildScript).toMatch(/blockedPathSegments[\s\S]*["']lmf["']/);
  });
});

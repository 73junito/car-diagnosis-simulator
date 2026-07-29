const {
  EvidenceEngine,
  updateFaultProbabilities,
  clampProbability,
  DEFAULT_FAULT_INTERACTIONS
} = require('../../../src/diagnostics');

describe('shared diagnostic evidence engine', () => {
  test('updates battery and starter probabilities', () => {
    const probabilities = {
      battery: 0.5,
      starter: 0.5,
      fuel: 0.5,
      ecu: 0.5
    };

    const result = updateFaultProbabilities({
      faultProbabilities: probabilities,
      faultInteractions: {},
      component: 'battery',
      interpretation: 'LOW voltage detected'
    });

    expect(result).toBe(probabilities);
    expect(probabilities.battery).toBeCloseTo(0.75);
    expect(probabilities.starter).toBeCloseTo(0.4);
  });

  test('applies starter evidence', () => {
    const probabilities = {
      starter: 0.5
    };

    updateFaultProbabilities({
      faultProbabilities: probabilities,
      faultInteractions: {},
      component: 'starter',
      interpretation: 'Current draw test'
    });

    expect(probabilities.starter).toBeCloseTo(0.7);
  });

  test('applies zero fuel-pressure evidence', () => {
    const probabilities = {
      fuel: 0.5
    };

    updateFaultProbabilities({
      faultProbabilities: probabilities,
      faultInteractions: {},
      component: 'fuel',
      interpretation: '0 PSI'
    });

    expect(probabilities.fuel).toBeCloseTo(0.7);
  });

  test('applies OBD evidence to ECU probability', () => {
    const probabilities = {
      ecu: 0.5
    };

    updateFaultProbabilities({
      faultProbabilities: probabilities,
      faultInteractions: {},
      component: 'obd',
      interpretation: 'Diagnostic trouble code found'
    });

    expect(probabilities.ecu).toBeCloseTo(0.65);
  });

  test('applies configured fault interactions', () => {
    const probabilities = {
      battery: 0.5,
      starter: 0.5
    };

    updateFaultProbabilities({
      faultProbabilities: probabilities,
      faultInteractions:
        DEFAULT_FAULT_INTERACTIONS,
      component: 'starter',
      interpretation: 'Weak crank'
    });

    expect(probabilities.starter).toBeCloseTo(0.7);
    expect(probabilities.battery).toBeCloseTo(0.7);
  });

  test('preserves original fallback behavior for zero', () => {
    const probabilities = {
      starter: 0
    };

    updateFaultProbabilities({
      faultProbabilities: probabilities,
      faultInteractions: {},
      component: 'starter',
      interpretation: ''
    });

    expect(probabilities.starter).toBeCloseTo(0.7);
  });

  test('clamps probabilities to the valid range', () => {
    expect(clampProbability(1.4)).toBe(1);
    expect(clampProbability(-0.4)).toBe(0);
    expect(clampProbability(0.6)).toBe(0.6);
    expect(clampProbability('invalid')).toBe(0);
  });

  test('returns safely for a missing probability object', () => {
    expect(
      updateFaultProbabilities({
        faultProbabilities: null,
        component: 'battery',
        interpretation: 'low'
      })
    ).toBeNull();
  });

  test('EvidenceEngine delegates to the pure updater', () => {
    const engine = new EvidenceEngine({
      faultInteractions: {}
    });

    const probabilities = {
      fuel: 0.5
    };

    const result = engine.evaluate({
      faultProbabilities: probabilities,
      component: 'fuel',
      interpretation: 'No pressure'
    });

    expect(result).toBe(probabilities);
    expect(probabilities.fuel).toBeCloseTo(0.7);
  });
});

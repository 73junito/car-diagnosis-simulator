const {
  evaluateLogicTree,
  sumEvidence,
  LogicTree
} = require('../../../src/diagnostics');

describe('shared diagnostic logic tree', () => {
  test('sums evidence weights safely', () => {
    expect(
      sumEvidence([
        { weight: 1.2 },
        { weight: 0.8 },
        {},
        null
      ])
    ).toBeCloseTo(2);
  });

  test('ignores invalid evidence weights', () => {
    expect(
      sumEvidence([
        { weight: 'invalid' },
        { weight: 1 }
      ])
    ).toBe(1);
  });

  test('rejects a diagnosis that does not match the fault', () => {
    const result = evaluateLogicTree({
      choice: 'battery',
      diagnosedSystem: 'electrical',
      scenario: {
        fault: 'fuel'
      },
      selectedSystem: 'electrical',
      evidenceBySystem: {
        electrical: [
          {
            reading: '11.4 V',
            interpretation: 'LOW',
            weight: 1.2
          }
        ]
      }
    });

    expect(result.correct).toBe(false);
    expect(result.faultMatch).toBe(false);
    expect(result.trace).toContainEqual({
      node: 'verdict',
      passed: false,
      reason: 'choice does not match expected fault'
    });
  });

  test('accepts a matching fault supported by evidence', () => {
    const result = evaluateLogicTree({
      choice: 'battery',
      diagnosedSystem: 'electrical',
      scenario: {
        fault: 'battery'
      },
      selectedSystem: 'electrical',
      evidenceBySystem: {
        electrical: [
          {
            reading: '11.4 V',
            interpretation: 'LOW',
            weight: 1.4
          }
        ],
        fuel: [
          {
            reading: '55 psi',
            interpretation: 'OK',
            weight: 0.5
          }
        ]
      }
    });

    expect(result.correct).toBe(true);
    expect(result.problematic).toBe(true);
    expect(result.isolationCorrect).toBe(true);
    expect(result.relevance).toBeGreaterThan(0.2);
  });

  test('supports a matching compound fault', () => {
    const result = evaluateLogicTree({
      choice: 'starter',
      diagnosedSystem: 'electrical',
      scenario: {
        fault: 'battery_or_starter'
      },
      selectedSystem: 'electrical',
      evidenceBySystem: {
        electrical: [
          {
            reading: 'Starter current excessive',
            interpretation: 'PROBLEM',
            weight: 1.2
          }
        ]
      }
    });

    expect(result.correct).toBe(true);
    expect(result.faultMatch).toBe(true);
  });

  test('requires aligned isolation when no evidence exists', () => {
    const aligned = evaluateLogicTree({
      choice: 'battery',
      diagnosedSystem: 'electrical',
      scenario: {
        fault: 'battery'
      },
      selectedSystem: 'electrical',
      evidenceBySystem: {}
    });

    const unaligned = evaluateLogicTree({
      choice: 'battery',
      diagnosedSystem: 'electrical',
      scenario: {
        fault: 'battery'
      },
      selectedSystem: 'fuel',
      evidenceBySystem: {}
    });

    expect(aligned.correct).toBe(true);
    expect(unaligned.correct).toBe(false);
  });

  test('LogicTree class delegates to the pure function', () => {
    const tree = new LogicTree();

    const result = tree.evaluate({
      choice: 'fuel',
      diagnosedSystem: 'fuel',
      scenario: {
        fault: 'fuel'
      },
      selectedSystem: 'fuel',
      evidenceBySystem: {
        fuel: [
          {
            reading: '0 psi',
            interpretation: 'NO PRESSURE',
            weight: 1.4
          }
        ]
      }
    });

    expect(result.correct).toBe(true);
  });
});

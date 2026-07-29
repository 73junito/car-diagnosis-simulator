const {
  normalizeToken,
  isFaultMatch,
  formatToolOutput,
  EvidenceEngine,
  ProbabilityEngine,
  LogicTree,
  ExplanationEngine,
  BrowserAdapter,
  createDiagnosticContext
} = require('../../../src/diagnostics');

describe('shared diagnostics reasoning engine', () => {
  describe('normalizeToken', () => {
    test('normalizes spaces and punctuation', () => {
      expect(normalizeToken('Starter Motor Fault')).toBe(
        'starter_motor_fault'
      );
    });

    test('normalizes known spark plug aliases', () => {
      expect(normalizeToken('spark')).toBe('spark_plugs');
      expect(normalizeToken('Spark Plugs')).toBe('spark_plugs');
      expect(normalizeToken('plug')).toBe('spark_plugs');
    });

    test('returns an empty string for empty input', () => {
      expect(normalizeToken()).toBe('');
      expect(normalizeToken('')).toBe('');
    });
  });

  describe('isFaultMatch', () => {
    test('matches exact normalized faults', () => {
      expect(isFaultMatch('battery', 'battery')).toBe(true);
    });

    test('matches a fault contained in a compound value', () => {
      expect(
        isFaultMatch('starter', 'battery_or_starter')
      ).toBe(true);
    });

    test('matches known aliases', () => {
      expect(isFaultMatch('spark', 'spark_plugs')).toBe(true);
    });

    test('supports arrays of faults', () => {
      expect(
        isFaultMatch('fuel', ['battery', 'fuel'])
      ).toBe(true);
    });

    test('rejects unrelated faults', () => {
      expect(isFaultMatch('battery', 'fuel')).toBe(false);
    });

    test('rejects missing values safely', () => {
      expect(isFaultMatch('', 'battery')).toBe(false);
      expect(isFaultMatch('battery', null)).toBe(false);
    });
  });

  describe('formatToolOutput', () => {
    test('returns the expected formatted diagnostic text', () => {
      expect(
        formatToolOutput(
          'Electrical',
          'BATTERY TEST',
          '11.4 V',
          'Below normal operating range',
          'Potential issue detected'
        )
      ).toBe(
        [
          '[SYSTEM: Electrical]',
          'Test: BATTERY TEST',
          'Result: 11.4 V',
          'Interpretation: Below normal operating range',
          'Conclusion: Potential issue detected'
        ].join('\n')
      );
    });
  });

  test('exports the remaining diagnostics architecture', () => {
    expect(EvidenceEngine).toBeDefined();
    expect(ProbabilityEngine).toBeDefined();
    expect(LogicTree).toBeDefined();
    expect(ExplanationEngine).toBeDefined();
    expect(BrowserAdapter).toBeDefined();
    expect(createDiagnosticContext).toBeDefined();
  });

  test('creates a plain diagnostic context', () => {
    expect(
      createDiagnosticContext({
        selectedSystem: 'electrical'
      })
    ).toEqual({
      scenario: null,
      selectedSystem: 'electrical',
      evidenceBySystem: {},
      faultProbabilities: {}
    });
  });
});

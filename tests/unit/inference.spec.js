const { decayFlapCount, shouldReopen, applyReopenMetadata } = require('../../core/diagnosis/inference');
const { evaluateSignals } = require('../../core/diagnosis/inference');

test('decayFlapCount reduces by steps based on days', () => {
  const old = 5;
  const daysSince = 30; // two decay steps if decayDays=14
  const result = decayFlapCount(old, daysSince, 14, 1);
  expect(result).toBe(3);
});

test('decayFlapCount never negative', () => {
  const result = decayFlapCount(1, 1000, 14, 1);
  expect(result).toBe(0);
});

test('shouldReopen enforces minOccurrences and backoff', () => {
  expect(shouldReopen({ flapCount: 0 })).toBe(false);
  expect(shouldReopen({ flapCount: 1, minOccurrences: 2 })).toBe(false);
  expect(shouldReopen({ flapCount: 3, minOccurrences: 2, runsSinceClose: 1, backoffRuns: 2 })).toBe(false);
  expect(shouldReopen({ flapCount: 3, minOccurrences: 2, runsSinceClose: 2, backoffRuns: 2 })).toBe(true);
});

test('applyReopenMetadata attaches flap_count and reopened flag', () => {
  const body = { a: 1 };
  const out = applyReopenMetadata(body, 4);
  expect(out.flap_count).toBe(4);
  expect(out.reopened).toBe(true);
  expect(out.a).toBe(1);
  expect(typeof out.reopened_at).toBe('string');
});

test('evaluateSignals: strong signal should reopen', () => {
  const signals = [{ symptom: 'integration_failure', likelyCauses: ['artifact_parser_issue'] }];
  const ctx = { flapCount: 1, runsSinceClose: 2, daysSinceLast: 0, thresholds: { minOccurrences: 1, backoffRuns: 0 } };
  const out = evaluateSignals(signals, ctx);
  expect(out.score).toBeGreaterThanOrEqual(0);
  expect(typeof out.shouldReopen).toBe('boolean');
  expect(out.updatedFlapCount).toBeGreaterThanOrEqual(1);
  expect(out.reasons.length).toBeGreaterThanOrEqual(0);
});

test('evaluateSignals: no signals yields no reopen', () => {
  const out = evaluateSignals([], { flapCount: 0, runsSinceClose: 0 });
  expect(out.score).toBe(0);
  expect(out.shouldReopen).toBe(false);
});

test('evaluateSignals: high flapCount lowers score', () => {
  const signals = [{ symptom: 'integration_failure', likelyCauses: ['artifact_parser_issue'] }];
  const ctxA = { flapCount: 0, runsSinceClose: 10, daysSinceLast: 30 };
  const ctxB = { flapCount: 10, runsSinceClose: 1, daysSinceLast: 0 };
  const a = evaluateSignals(signals, ctxA);
  const b = evaluateSignals(signals, ctxB);
  expect(a.score).toBeGreaterThanOrEqual(b.score);
});

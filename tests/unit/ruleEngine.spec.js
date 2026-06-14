const { normalizeFindings, detectRegressionSignals } = require('../../core/diagnosis/ruleEngine');

test('normalizeFindings maps tests to findings', () => {
  const parsed = {
    tests: [
      { name: 'auto-open.integration.shouldOpen', status: 'fail', suite: 'integration' },
      { name: 'utils.unit.shouldParse', status: 'fail', suite: 'unit' }
    ]
  };
  const findings = normalizeFindings(parsed);
  expect(findings.length).toBe(2);
  expect(findings[0].symptom).toBe('integration_failure');
  expect(findings[1].symptom).toBe('unit_failure');
  expect(findings[0].severity).toBe('fail');
});

test('detectRegressionSignals uses graphModel.getCauses', () => {
  const findings = [{ symptom: 'integration_failure' }, { symptom: 'unit_failure' }];
  const graphModel = {
    getCauses: (s) => s === 'integration_failure' ? ['artifact_parser_issue', 'fetch_mock_mismatch'] : []
  };
  const signals = detectRegressionSignals(findings, graphModel);
  expect(signals.length).toBe(2);
  expect(signals[0]).toHaveProperty('likelyCauses');
  expect(signals[0].likelyCauses).toEqual(expect.arrayContaining(['artifact_parser_issue']));
  expect(signals[1].likelyCauses.length).toBe(0);
});

/**
 * Convert parsed artifact model into normalized findings.
 * @param {{tests: Array}} parsedArtifact
 * @returns {Array} findings
 */
function normalizeFindings(parsedArtifact) {
  const out = [];
  const tests = (parsedArtifact && Array.isArray(parsedArtifact.tests)) ? parsedArtifact.tests : [];
  for (const t of tests) {
    const name = t.name || t.fullName || t.title || 'unknown';
    const suite = (t.suite || '').toString();
    const status = (t.status || t.outcome || 'unknown').toString().toLowerCase();

    let symptom = 'test_failure';
    if (suite.toLowerCase().includes('integration') || name.toLowerCase().includes('integration')) symptom = 'integration_failure';
    else if (suite.toLowerCase().includes('unit') || name.toLowerCase().includes('unit')) symptom = 'unit_failure';

    out.push({
      symptom,
      severity: status,
      suite: suite || null,
      name
    });
  }
  return out;
}

/**
 * Given normalized findings and a graphModel, return candidate regression signals.
 * @param {Array} findings
 * @param {{getCauses: function}} graphModel
 */
function detectRegressionSignals(findings, graphModel) {
  const signals = [];
  for (const f of findings) {
    const causes = (graphModel && typeof graphModel.getCauses === 'function') ? graphModel.getCauses(f.symptom) : [];
    signals.push({
      symptom: f.symptom,
      likelyCauses: Array.isArray(causes) ? causes.slice() : []
    });
  }
  return signals;
}

module.exports = {
  normalizeFindings,
  detectRegressionSignals
};

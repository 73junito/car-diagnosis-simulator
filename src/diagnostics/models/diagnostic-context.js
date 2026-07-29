function createDiagnosticContext(input = {}) {
  return {
    scenario: input.scenario || null,
    selectedSystem: input.selectedSystem || null,
    evidenceBySystem: input.evidenceBySystem || {},
    faultProbabilities: input.faultProbabilities || {}
  };
}

module.exports = {
  createDiagnosticContext
};

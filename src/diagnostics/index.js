const reasoning = require('./engine/reasoning-engine');
const LogicTree = require('./engine/logic-tree');
const EvidenceEngine = require('./engine/evidence-engine');

module.exports = {
  ...reasoning,

  evaluateLogicTree:
    LogicTree.evaluateLogicTree,

  sumEvidence:
    LogicTree.sumEvidence,

  updateFaultProbabilities:
    EvidenceEngine.updateFaultProbabilities,

  clampProbability:
    EvidenceEngine.clampProbability,

  DEFAULT_FAULT_INTERACTIONS:
    EvidenceEngine.DEFAULT_FAULT_INTERACTIONS,

  EvidenceEngine,

  ProbabilityEngine:
    require('./engine/probability-engine'),

  LogicTree,

  ExplanationEngine:
    require('./engine/explanation-engine'),

  BrowserAdapter:
    require('./adapters/browser-adapter'),

  createDiagnosticContext:
    require('./models/diagnostic-context')
      .createDiagnosticContext
};

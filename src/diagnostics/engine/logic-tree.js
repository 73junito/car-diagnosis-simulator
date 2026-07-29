const { isFaultMatch } = require('./reasoning-engine');

const PROBLEM_PATTERN =
  /low|no|problem|leak|slip|misfire|degrad|sticky|clog|<12v|0 psi|weak|fault|fail/i;

function sumEvidence(entries = []) {
  if (!Array.isArray(entries)) {
    return 0;
  }

  return entries.reduce((total, entry) => {
    const weight = Number(entry?.weight || 0);
    return total + (Number.isFinite(weight) ? weight : 0);
  }, 0);
}

function evaluateLogicTree({
  choice,
  diagnosedSystem,
  scenario,
  evidenceBySystem,
  selectedSystem
} = {}) {
  const trace = [];

  const safeEvidence =
    evidenceBySystem && typeof evidenceBySystem === 'object'
      ? evidenceBySystem
      : {};

  const system = diagnosedSystem || null;

  const diagnosedEvidence =
    system && Array.isArray(safeEvidence[system])
      ? safeEvidence[system]
      : [];

  const evidenceSum = sumEvidence(diagnosedEvidence);

  const rawTotal = Object.keys(safeEvidence).reduce(
    (total, key) => total + sumEvidence(safeEvidence[key]),
    0
  );

  const totalSum = rawTotal || 1;
  const relevance = evidenceSum / totalSum;

  const problematic = diagnosedEvidence.some((entry) =>
    PROBLEM_PATTERN.test(
      `${entry?.reading || ''} ${entry?.interpretation || ''}`
    )
  );

  const faultMatch = isFaultMatch(
    choice,
    scenario?.fault
  );

  const isolationCorrect =
    Boolean(selectedSystem) &&
    selectedSystem === system;

  const hasEvidence = diagnosedEvidence.length > 0;

  const maxOtherEvidence = Object.keys(safeEvidence)
    .filter((key) => key !== system)
    .reduce(
      (maximum, key) =>
        Math.max(maximum, sumEvidence(safeEvidence[key])),
      0
    );

  const strongerThanOthers =
    evidenceSum >= maxOtherEvidence + 0.1;

  trace.push({
    node: 'fault_match',
    passed: faultMatch
  });

  if (!faultMatch) {
    trace.push({
      node: 'verdict',
      passed: false,
      reason: 'choice does not match expected fault'
    });

    return {
      correct: false,
      faultMatch,
      relevance,
      problematic,
      isolationCorrect,
      evidenceSum,
      totalSum,
      strongerThanOthers,
      trace
    };
  }

  trace.push({
    node: 'has_evidence',
    passed: hasEvidence
  });

  if (!hasEvidence) {
    const correct = isolationCorrect;

    trace.push({
      node: 'verdict',
      passed: correct,
      reason: correct
        ? 'matched fault with aligned isolation'
        : 'matched fault without system evidence'
    });

    return {
      correct,
      faultMatch,
      relevance,
      problematic,
      isolationCorrect,
      evidenceSum,
      totalSum,
      strongerThanOthers,
      trace
    };
  }

  const supportSignals = [
    {
      node: 'problematic_evidence',
      passed: problematic
    },
    {
      node: 'relevance_threshold',
      passed: relevance >= 0.2
    },
    {
      node: 'isolation_alignment',
      passed: isolationCorrect
    },
    {
      node: 'dominant_evidence',
      passed: strongerThanOthers
    }
  ];

  supportSignals.forEach((signal) => {
    trace.push(signal);
  });

  const correct = supportSignals.some(
    (signal) => signal.passed
  );

  trace.push({
    node: 'verdict',
    passed: correct,
    reason: correct
      ? 'fault match supported by evidence tree'
      : 'fault match lacks support in evidence tree'
  });

  return {
    correct,
    faultMatch,
    relevance,
    problematic,
    isolationCorrect,
    evidenceSum,
    totalSum,
    strongerThanOthers,
    trace
  };
}

class LogicTree {
  evaluate(input) {
    return evaluateLogicTree(input);
  }
}

LogicTree.evaluateLogicTree = evaluateLogicTree;
LogicTree.sumEvidence = sumEvidence;

module.exports = LogicTree;
module.exports.evaluateLogicTree = evaluateLogicTree;
module.exports.sumEvidence = sumEvidence;

// TorqueMind seven-level analysis-depth contract.
// Levels 1-3: basic analysis; 4-5: deep analysis; 6-7: architectural/system analysis.
(function (root) {
  'use strict';

  const LEVELS = Object.freeze({
    1: Object.freeze({ level: 1, band: 'basic', label: 'Basic Analysis I', focus: 'Identify observable symptoms, facts, and the immediate component or subsystem.' }),
    2: Object.freeze({ level: 2, band: 'basic', label: 'Basic Analysis II', focus: 'Interpret direct measurements and compare them with expected operating conditions.' }),
    3: Object.freeze({ level: 3, band: 'basic', label: 'Basic Analysis III', focus: 'Connect evidence to a likely fault and select a justified next diagnostic step.' }),
    4: Object.freeze({ level: 4, band: 'deep', label: 'Deep Analysis I', focus: 'Correlate multiple evidence sources, test competing hypotheses, and explain causal relationships.' }),
    5: Object.freeze({ level: 5, band: 'deep', label: 'Deep Analysis II', focus: 'Resolve ambiguous or interacting faults using weighted evidence and alternative explanations.' }),
    6: Object.freeze({ level: 6, band: 'architectural-system', label: 'Architectural/System Analysis I', focus: 'Analyze cross-system dependencies, interfaces, data or energy flow, and cascading effects.' }),
    7: Object.freeze({ level: 7, band: 'architectural-system', label: 'Architectural/System Analysis II', focus: 'Evaluate whole-system behavior, architecture-level failure modes, tradeoffs, and corrective strategy.' })
  });

  function normalizeLevel(value) {
    const level = Number(value);
    return Number.isInteger(level) && level >= 1 && level <= 7 ? level : null;
  }

  function get(level) {
    const normalized = normalizeLevel(level);
    return normalized ? LEVELS[normalized] : null;
  }

  function bandFor(level) {
    const entry = get(level);
    return entry ? entry.band : null;
  }

  const api = Object.freeze({ levels: LEVELS, normalizeLevel, get, bandFor });
  root.TorqueMindAnalysisLevels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

function loadScriptIntoWindow(filePath, window) {
  const code = fs.readFileSync(filePath, 'utf8');
   
  const fn = new Function('window','document','self','location','history', code + '\n//# sourceURL=' + filePath);
  fn(window, window.document, window, window.location, window.history);
}

describe('DiagnosticEngine unit tests', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<!doctype html><html><head></head><body></body></html>';
    // reset globals
    window.evidence = {};
    window.faultProbabilities = {};
    window.toolUses = 0;
    window.totalToolUsed = 0;
    window.score = 0;
    window.correctAnswers = 0;
    window.wrongAnswers = 0;
  });

  test('applyEvidenceToModel updates fault probabilities for battery', () => {
    loadScriptIntoWindow(path.resolve(__dirname, '../../engine/diagnosticEngine.js'), window);
    const D = window.DiagnosticEngine;
    // initialize fp
    D.faultProbabilities = { battery: 0.5, starter: 0.5 };
    D.applyEvidenceToModel('battery', 'low voltage detected');
    expect(D.faultProbabilities.battery).toBeGreaterThan(0.5);
    // starter may be adjusted by interactions; ensure probabilities remain valid
    expect(D.faultProbabilities.starter).toBeGreaterThanOrEqual(0);
    expect(D.faultProbabilities.starter).toBeLessThanOrEqual(1);
  });

  test('useTool records evidence and sets weight and updates probabilities', () => {
    loadScriptIntoWindow(path.resolve(__dirname, '../../engine/diagnosticEngine.js'), window);
    const D = window.DiagnosticEngine;
    // prepare a scenario with battery test
    window.currentScenario = () => ({ tests: { battery: { system: 'electrical', reading: '11.2V', interpretation: 'LOW' } } });
    window.selectedSystem = 'electrical';
    window.systemWeights = { electrical: 1.0 };
    window.maxToolUses = 5;
    window.toolUses = 0;
    window.evidence = {};
    D.faultProbabilities = { battery: 0.5, starter: 0.5, fuel: 0.5, ecu: 0.5 };

    const out = D.useTool('battery');
    // after calling, evidence for electrical should exist
    expect(window.evidence.electrical).toBeDefined();
    expect(window.evidence.electrical.length).toBeGreaterThan(0);
    // weight should be attached to evidence entry
    expect(window.evidence.electrical[0].weight).toBeDefined();
    // fault probabilities should update
    expect(D.faultProbabilities.battery).toBeGreaterThan(0.5);
  });

  test('applyDiagnosisWithConfidence marks correct and updates score', async () => {
    loadScriptIntoWindow(path.resolve(__dirname, '../../engine/diagnosticEngine.js'), window);
    const D = window.DiagnosticEngine;
    // scenario where fault is 'battery'
    window.scenarios = [{ id: 1, fault: 'battery' }];
    window.currentScenario = () => window.scenarios[0];
    // simulate collected evidence for electrical with sufficient weight
    window.evidence = { electrical: [ { weight: 1.0, reading: '11.0V', interpretation: 'LOW', source: 'battery' } ] };
    window.pendingDiagnosisChoice = 'battery';
    window.selectedSystem = 'electrical';
    window.score = 0;

    await D.applyDiagnosisWithConfidence('high');
    expect(window.lastExplanation).toBeDefined();
    expect(window.lastExplanation.final).toBe('Correct');
    expect(window.score).toBeGreaterThan(0);
  });

  test('applyDiagnosisWithConfidence handles incorrect diagnosis without throwing', async () => {
    loadScriptIntoWindow(path.resolve(__dirname, '../../engine/diagnosticEngine.js'), window);
    const D = window.DiagnosticEngine;
    window.scenarios = [{ id: 2, fault: 'fuel' }];
    window.currentScenario = () => window.scenarios[0];
    window.evidence = {};
    window.pendingDiagnosisChoice = 'battery';
    window.selectedSystem = 'electrical';
    window.score = 10;

    await expect(D.applyDiagnosisWithConfidence('medium')).resolves.not.toThrow();
    expect(window.lastExplanation).toBeDefined();
    expect(window.lastExplanation.final).toBe('Incorrect');
  });
});

/**
 * @jest-environment jsdom
 *
 * Tests for the browser-side DiagnosticEngine IIFE (engine/diagnosticEngine.js).
 *
 * The file contains two IIFEs; the second one (lines 301-541) overwrites
 * window.DiagnosticEngine and is the live implementation.  Its API uses
 * window globals (selectedSystem, evidence, currentScenario, etc.) rather
 * than an AppState argument.
 *
 * Each test re-requires the engine module (via jest.resetModules) so the IIFE
 * re-executes with a clean closure.
 */

'use strict';

const ENGINE_PATH = '../../engine/diagnosticEngine.js';

// DOM_TEMPLATE replaced by programmatic construction inside setupEngine

// Scenarios used by the engine via window.currentScenario()
const SCENARIO_BATTERY_FAULT = {
  tests: {
    battery: '11.2V (low voltage)',
    starter: 'clicking sound — starter engaging',
    fuel: '0 psi — no fuel pressure',
    obd: 'P0300 random misfire',
  },
  fault: 'battery',
};

const SCENARIO_FUEL_FAULT = {
  tests: { battery: '12.6V (normal)', fuel: 'no pressure (0 psi)' },
  fault: 'fuel',
};

/**
 * Reset module cache, rebuild DOM, reset all window globals, require the
 * engine and return the exposed DiagnosticEngine object.
 */
function setupEngine(scenario = SCENARIO_BATTERY_FAULT) {
  jest.resetModules();

  // build minimal DOM required by the engine tests
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  ['result','score','toolsLeft','confidencePanel','explanationPanel','exp-system','exp-rationale','exp-relevance','exp-isolation','exp-confidence','exp-reasoning','exp-evidence','exp-final'].forEach((id)=>{
    const el = document.createElement('div'); el.id = id;
    if (id === 'confidencePanel' || id === 'explanationPanel') el.style.display = 'none';
    document.body.appendChild(el);
  });

  window.currentScenario = () => scenario;
  window.scenarios = [SCENARIO_BATTERY_FAULT, SCENARIO_FUEL_FAULT];
  window.currentIndex = 0;
  window.evidence = {};
  window.toolUses = 0;
  window.totalToolUsed = 0;
  window.maxToolUses = 5;
  window.score = 0;
  window.correctAnswers = 0;
  window.wrongAnswers = 0;
  window.selectedSystem = 'electrical'; // must be truthy for useTool to proceed
  window.systemJustification = 'electrical';
  window.systemWeights = { electrical: 1.0, fuel: 1.0, ignition: 1.0, air: 0.9, ecu: 0.9, engine: 0.8 };
  window.pendingDiagnosisChoice = null;
  window.saveProgress = jest.fn().mockResolvedValue(undefined);
  window.loadScenario = jest.fn();
  window.endGame = jest.fn();
  window.updateStudentProfile = jest.fn();

  require(ENGINE_PATH);
  return window.DiagnosticEngine;
}

// ─── DiagnosticEngine object shape ───────────────────────────────────────────

describe('DiagnosticEngine — object shape', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('exposes useTool, diagnose, applyDiagnosisWithConfidence, and applyEvidenceToModel', () => {
    expect(typeof Engine.useTool).toBe('function');
    expect(typeof Engine.diagnose).toBe('function');
    expect(typeof Engine.applyDiagnosisWithConfidence).toBe('function');
    expect(typeof Engine.applyEvidenceToModel).toBe('function');
  });

  it('exposes formatToolOutput helper', () => {
    expect(typeof Engine.formatToolOutput).toBe('function');
    const out = Engine.formatToolOutput('Electrical', 'BATTERY TEST', '11V', 'Low', 'Potential fault');
    expect(out).toContain('[SYSTEM: Electrical]');
    expect(out).toContain('BATTERY TEST');
    expect(out).toContain('11V');
  });

  it('initialises faultProbabilities as empty object', () => {
    expect(Engine.faultProbabilities).toEqual({});
  });
});

// ─── useTool — early-exit guards ─────────────────────────────────────────────

describe('DiagnosticEngine.useTool — early-exit guards', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('displays a message and does NOT add evidence when selectedSystem is falsy', () => {
    window.selectedSystem = null;
    Engine.useTool('battery');
    expect(window.evidence).toEqual({});
    const result = document.getElementById('result');
    expect(result.innerText).toContain('select');
  });

  it('displays a no-tool-uses message when toolUses >= maxToolUses', () => {
    window.toolUses = window.maxToolUses;
    Engine.useTool('battery');
    expect(window.evidence).toEqual({});
    const result = document.getElementById('result');
    expect(result.innerText).toContain('No tool uses left');
  });
});

// ─── useTool — evidence accumulation ─────────────────────────────────────────

describe('DiagnosticEngine.useTool — evidence accumulation', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('adds evidence to window.evidence[electrical] for battery component', () => {
    Engine.useTool('battery');
    expect(window.evidence.electrical).toBeDefined();
    expect(window.evidence.electrical.length).toBe(1);
  });

  it('adds evidence to window.evidence[fuel] for fuel component', () => {
    window.selectedSystem = 'fuel';
    Engine.useTool('fuel');
    expect(window.evidence.fuel).toBeDefined();
    expect(window.evidence.fuel.length).toBe(1);
  });

  it('adds evidence to window.evidence[ecu] for obd component', () => {
    Engine.useTool('obd');
    expect(window.evidence.ecu).toBeDefined();
  });

  it('accumulates multiple evidence entries across calls', () => {
    Engine.useTool('battery');
    Engine.useTool('battery'); // call same component twice
    expect(window.evidence.electrical.length).toBe(2);
  });

  it('evidence entry contains reading, interpretation, weight, and source', () => {
    Engine.useTool('battery');
    const entry = window.evidence.electrical[0];
    expect(entry).toHaveProperty('reading');
    expect(entry).toHaveProperty('interpretation');
    expect(entry).toHaveProperty('weight');
    expect(entry).toHaveProperty('source', 'battery');
  });

  it('records PROBLEM interpretation for low-voltage battery reading', () => {
    Engine.useTool('battery'); // reads '11.2V (low voltage)'
    expect(window.evidence.electrical[0].interpretation).toBe('PROBLEM');
  });

  it('records PROBLEM interpretation for zero-pressure fuel reading', () => {
    window.selectedSystem = 'fuel';
    Engine.useTool('fuel'); // reads '0 psi — no fuel pressure'
    expect(window.evidence.fuel[0].interpretation).toBe('PROBLEM');
  });

  it('records No data and UNKNOWN when component has no test in scenario', () => {
    Engine.useTool('nonexistent_sensor');
    // component falls under 'other'
    const entry = (window.evidence.other || [])[0];
    expect(entry.reading).toBe('No data');
    expect(entry.interpretation).toBe('UNKNOWN');
  });
});

// ─── useTool — fault probability model ───────────────────────────────────────

describe('DiagnosticEngine.useTool — fault probability model', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('populates faultProbabilities after calling applyEvidenceToModel for battery', () => {
    Engine.useTool('battery');
    expect(typeof Engine.faultProbabilities.battery).toBe('number');
  });

  it('raises battery probability above initial 0.5 for a low-voltage reading', () => {
    Engine.applyEvidenceToModel('battery', 'low voltage');
    expect(Engine.faultProbabilities.battery).toBeGreaterThan(0.5);
  });

  it('raises fuel probability for a no-pressure reading', () => {
    Engine.applyEvidenceToModel('fuel', 'no pressure');
    expect(Engine.faultProbabilities.fuel).toBeGreaterThan(0.5);
  });

  it('raises ecu probability after an obd reading', () => {
    Engine.applyEvidenceToModel('obd', 'P0300 misfire');
    expect(Engine.faultProbabilities.ecu).toBeGreaterThan(0.5);
  });

  it('raises starter probability after a starter test', () => {
    Engine.applyEvidenceToModel('starter', 'any reading');
    expect(Engine.faultProbabilities.starter).toBeGreaterThan(0.5);
  });

  it('keeps probabilities clamped to [0, 1] after repeated calls', () => {
    for (let i = 0; i < 10; i++) {
      Engine.applyEvidenceToModel('battery', 'low voltage');
      Engine.applyEvidenceToModel('fuel', 'no pressure');
      Engine.applyEvidenceToModel('obd', 'fault');
    }
    Object.values(Engine.faultProbabilities).forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });
});

// ─── useTool — weight calculation ────────────────────────────────────────────

describe('DiagnosticEngine.useTool — weight calculation', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('weight is a positive number', () => {
    Engine.useTool('battery');
    expect(window.evidence.electrical[0].weight).toBeGreaterThan(0);
  });

  it('applies isolation boost when selectedSystem matches component system', () => {
    window.selectedSystem = 'electrical';
    Engine.useTool('battery');
    const boostedWeight = window.evidence.electrical[0].weight;

    Engine = setupEngine();
    window.selectedSystem = 'fuel'; // different from battery's system
    Engine.useTool('battery');
    const unboostedWeight = (window.evidence.electrical || [])[0].weight;

    expect(boostedWeight).toBeGreaterThan(unboostedWeight);
  });
});

// ─── useTool — DOM output ─────────────────────────────────────────────────────

describe('DiagnosticEngine.useTool — DOM output', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('writes a formatted result to #result', () => {
    Engine.useTool('battery');
    const result = document.getElementById('result');
    expect(result.innerText).toContain('BATTERY TEST');
  });

  it('increments window.toolUses', () => {
    window.toolUses = 0;
    Engine.useTool('battery');
    expect(window.toolUses).toBe(1);
  });

  it('increments window.totalToolUsed', () => {
    window.totalToolUsed = 0;
    Engine.useTool('battery');
    expect(window.totalToolUsed).toBe(1);
  });

  it('deducts score when toolUses exceeds 2', () => {
    window.toolUses = 2; // will become 3 after useTool → deduction
    window.score = 10;
    Engine.useTool('battery');
    expect(window.score).toBeLessThan(10);
  });

  it('updates #toolsLeft counter in the DOM', () => {
    window.toolUses = 1;
    window.maxToolUses = 5;
    Engine.useTool('battery'); // toolUses becomes 2
    const el = document.getElementById('toolsLeft');
    expect(el.innerText).toContain('3'); // 5 - 2 = 3
  });
});

// ─── diagnose ─────────────────────────────────────────────────────────────────

describe('DiagnosticEngine.diagnose', () => {
  let Engine;
  beforeEach(() => { Engine = setupEngine(); });

  it('sets window.pendingDiagnosisChoice to the supplied choice', () => {
    Engine.diagnose('battery');
    expect(window.pendingDiagnosisChoice).toBe('battery');
  });

  it('makes the #confidencePanel visible', () => {
    Engine.diagnose('fuel');
    expect(document.getElementById('confidencePanel').style.display).toBe('block');
  });

  it('overwrites previous pending choice', () => {
    Engine.diagnose('starter');
    Engine.diagnose('fuel');
    expect(window.pendingDiagnosisChoice).toBe('fuel');
  });
});

// ─── applyDiagnosisWithConfidence ─────────────────────────────────────────────

describe('DiagnosticEngine.applyDiagnosisWithConfidence', () => {
  let Engine;

  // Helper: useTool to gather evidence before diagnosing
  function collectBatteryEvidence() {
    window.selectedSystem = 'electrical';
    Engine.useTool('battery');
  }

  beforeEach(() => {
    Engine = setupEngine(SCENARIO_BATTERY_FAULT); // fault = 'battery'
    collectBatteryEvidence();
  });

  it('clears pendingDiagnosisChoice after applying', async () => {
    window.pendingDiagnosisChoice = 'battery';
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.pendingDiagnosisChoice).toBeNull();
  });

  it('increments correctAnswers for a correct diagnosis', async () => {
    window.pendingDiagnosisChoice = 'battery'; // matches scenario fault
    window.correctAnswers = 0;
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.correctAnswers).toBe(1);
  });

  it('increases score for a correct high-confidence diagnosis', async () => {
    window.pendingDiagnosisChoice = 'battery';
    window.score = 0;
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.score).toBeGreaterThan(0);
  });

  it('awards more points for high confidence than low confidence', async () => {
    // High confidence
    Engine = setupEngine(SCENARIO_BATTERY_FAULT);
    collectBatteryEvidence();
    window.pendingDiagnosisChoice = 'battery';
    window.score = 0;
    await Engine.applyDiagnosisWithConfidence('high');
    const highScore = window.score;

    // Low confidence
    Engine = setupEngine(SCENARIO_BATTERY_FAULT);
    collectBatteryEvidence();
    window.pendingDiagnosisChoice = 'battery';
    window.score = 0;
    await Engine.applyDiagnosisWithConfidence('low');
    const lowScore = window.score;

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('increments wrongAnswers for an incorrect diagnosis', async () => {
    window.pendingDiagnosisChoice = 'fuel'; // wrong: fault is battery
    window.wrongAnswers = 0;
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.wrongAnswers).toBe(1);
  });

  it('deducts score for an incorrect diagnosis', async () => {
    window.pendingDiagnosisChoice = 'fuel'; // wrong
    window.score = 20;
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.score).toBeLessThan(20);
  });

  it('score never goes below zero after incorrect diagnosis', async () => {
    window.pendingDiagnosisChoice = 'fuel'; // wrong
    window.score = 0;
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.score).toBeGreaterThanOrEqual(0);
  });

  it('populates window.lastExplanation with result metadata', async () => {
    window.pendingDiagnosisChoice = 'battery';
    await Engine.applyDiagnosisWithConfidence('medium');
    const exp = window.lastExplanation;
    expect(exp).toBeDefined();
    expect(exp.final).toMatch(/correct|incorrect/i);
    expect(typeof exp.relevance).toBe('number');
    expect(exp.confidence).toBe('medium');
  });

  it('advances window.currentIndex after applying diagnosis', async () => {
    window.pendingDiagnosisChoice = 'battery';
    window.currentIndex = 0;
    await Engine.applyDiagnosisWithConfidence('high');
    expect(window.currentIndex).toBe(1);
  });

  it('hides the #confidencePanel after applying', async () => {
    document.getElementById('confidencePanel').style.display = 'block';
    window.pendingDiagnosisChoice = 'battery';
    await Engine.applyDiagnosisWithConfidence('medium');
    expect(document.getElementById('confidencePanel').style.display).toBe('none');
  });

  it('calls window.loadScenario if more scenarios remain', async () => {
    window.pendingDiagnosisChoice = 'battery';
    window.currentIndex = 0; // scenarios.length = 2, so after increment index=1 < 2
    jest.useFakeTimers();
    await Engine.applyDiagnosisWithConfidence('high');
    jest.runAllTimers();
    expect(window.loadScenario).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('calls window.endGame when last scenario is completed', async () => {
    window.pendingDiagnosisChoice = 'battery';
    window.currentIndex = 1; // after increment = 2, equals scenarios.length
    jest.useFakeTimers();
    await Engine.applyDiagnosisWithConfidence('high');
    jest.runAllTimers();
    expect(window.endGame).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
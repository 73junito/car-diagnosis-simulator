'use strict';

/**
 * Independent validation of the Starting-System v2.0.0 engineering fixtures.
 *
 * These tests check the hand-calculated expectations for internal consistency:
 * Kirchhoff current balance at every node, power balance, the declared
 * diagnostic signatures, the unavailable-state contract, and agreement between
 * the hand-authored ngspice decks and the template's declared parameters.
 *
 * No numerical engine is implemented in Gate 2B. Nothing here solves a circuit:
 * the tests verify that the expectations themselves are physically consistent,
 * which is what makes them usable as a Gate 2C oracle. A passing result is not
 * evidence that a solver exists or is correct.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const netlist = readJson('tests/simulators/starting-system-v2-expected-netlist.json');
const values = readJson('tests/simulators/starting-system-v2-expected-values.json');
const template = readJson('data/circuit-templates/12v-starting-system-v2.json');

/** Builds the post-fault topology for a scenario: removals then node splits. */
function buildTopology(scenario) {
  const removed = new Set(scenario.removedElements || []);
  let nodes = netlist.nodes.map((node) => node.nodeId);
  const elements = netlist.elements
    .filter((element) => !removed.has(element.elementId))
    .map((element) => ({ ...element }));

  for (const faultId of scenario.faultIds || []) {
    for (const split of values.scenarioNodeSplits[faultId] || []) {
      nodes = nodes.filter((node) => node !== split.splitNode);
      nodes.push(...split.intoNodes);
      for (const remap of split.elementRemap) {
        const element = elements.find((candidate) => candidate.elementId === remap.elementId);
        if (element) element[remap.endpoint] = remap.newNode;
      }
    }
  }
  return { nodes, elements };
}

/** Signed current balance at every node. Positive means current enters the node. */
function nodeBalance(topology, currents) {
  const balance = new Map(topology.nodes.map((node) => [node, 0]));
  for (const element of topology.elements) {
    const current = currents[element.elementId];
    if (typeof current !== 'number') continue;
    balance.set(element.fromNode, balance.get(element.fromNode) - current);
    balance.set(element.toNode, balance.get(element.toNode) + current);
  }
  return balance;
}

const numericScenarios = values.scenarios.filter((scenario) => scenario.expectedValues !== null);
const deferredScenarios = values.scenarios.filter((scenario) => scenario.expectedValues === null);

describe('Starting-System v2.0.0 engineering fixtures', () => {
  test('the fixture set declares at least five scenarios, with two deliberately deferred', () => {
    expect(values.scenarios).toHaveLength(7);
    expect(numericScenarios).toHaveLength(5);
    expect(deferredScenarios).toHaveLength(2);
    for (const scenario of deferredScenarios) {
      expect(typeof scenario.reason).toBe('string');
      expect(scenario.reason).toMatch(/magnitude/i);
    }
  });

  describe('Kirchhoff current balance', () => {
    for (const scenario of numericScenarios) {
      test(`${scenario.scenarioId}: every node balances to zero`, () => {
        const topology = buildTopology(scenario);
        const balance = nodeBalance(topology, scenario.elementCurrentsA);
        for (const [node, residual] of balance) {
          expect({ node, residual, balanced: Math.abs(residual) <= values.tolerance.kclResidualA })
            .toEqual({ node, residual, balanced: true });
        }
      });
    }
  });

  describe('power balance', () => {
    for (const scenario of numericScenarios) {
      test(`${scenario.scenarioId}: resistive dissipation equals source delivery`, () => {
        const topology = buildTopology(scenario);
        let resistive = 0;
        for (const element of topology.elements) {
          if (typeof element.resistanceOhm !== 'number') continue;
          const current = scenario.elementCurrentsA[element.elementId] || 0;
          resistive += current * current * element.resistanceOhm;
        }
        expect(Math.abs(resistive - scenario.powerBalance.resistiveAbsorbedW))
          .toBeLessThanOrEqual(values.tolerance.powerBalanceW);
        expect(Math.abs(scenario.powerBalance.sourceDeliveredW - scenario.powerBalance.resistiveAbsorbedW))
          .toBeLessThanOrEqual(values.tolerance.powerBalanceW);
      });
    }
  });

  describe('declared diagnostic signatures', () => {
    const byId = new Map(values.scenarios.map((scenario) => [scenario.scenarioId, scenario]));

    test('healthy crank: control point below battery, motor ground near reference', () => {
      const scenario = byId.get('healthy-crank');
      expect(scenario.testPointVoltagesV.TP_BAT_POS).toBeCloseTo(10.782432, 5);
      expect(scenario.testPointVoltagesV.TP_START_CMD).toBeCloseTo(10.77525, 5);
      expect(scenario.testPointVoltagesV.TP_SOLENOID_OUT).toBeCloseTo(10.553903, 5);
      expect(scenario.testPointVoltagesV.TP_MOTOR_GND).toBeCloseTo(0.083102, 5);
      expect(scenario.sourceCurrentDeliveredA).toBeCloseTo(211.345139, 5);
    });

    test('power-side open: solenoid output at battery voltage, motor side a proved zero', () => {
      const scenario = byId.get('open-motor-feed');
      expect(scenario.testPointVoltagesV.TP_SOLENOID_OUT).toBeCloseTo(12.564013, 5);
      expect(scenario.testPointVoltagesV.TP_MOTOR_GND).toBe(0);
      expect(scenario.nodeVoltagesV.N_MTR_PWR).toBe(0);
      expect(scenario.elementCurrentsA.E9).toBe(0);
    });

    test('ground-side open: the motor ground point floats up to battery voltage', () => {
      const scenario = byId.get('open-motor-ground');
      expect(scenario.testPointVoltagesV.TP_MOTOR_GND).toBeCloseTo(12.564013, 5);
      expect(scenario.testPointVoltagesV.TP_SOLENOID_OUT).toBeCloseTo(12.564013, 5);
      expect(scenario.sourceCurrentDeliveredA).toBeCloseTo(4.184517, 5);
    });

    test('open control: the derived contact opens, so the whole motor path is dead', () => {
      const scenario = byId.get('open-control-circuit');
      expect(scenario.relayContactState).toBe('open');
      expect(scenario.relayResolutionBasis).toBe('coil-voltage-below-hold');
      expect(scenario.sourceCurrentDeliveredA).toBe(0);
      expect(scenario.testPointVoltagesV.TP_START_CMD).toBeCloseTo(12.6, 5);
      expect(scenario.testPointVoltagesV.TP_SOLENOID_OUT).toBe(0);
      for (const current of Object.values(scenario.elementCurrentsA)) expect(current).toBe(0);
    });

    test('the four signatures are mutually distinguishable', () => {
      const signature = (id) => {
        const scenario = byId.get(id);
        return [
          scenario.testPointVoltagesV.TP_START_CMD,
          scenario.testPointVoltagesV.TP_SOLENOID_OUT,
          scenario.testPointVoltagesV.TP_MOTOR_GND,
          scenario.sourceCurrentDeliveredA
        ].join('|');
      };
      const signatures = ['healthy-crank', 'open-motor-feed', 'open-motor-ground', 'open-control-circuit']
        .map(signature);
      expect(new Set(signatures).size).toBe(4);
    });
  });

  describe('unavailable-state contract', () => {
    test('the open-coil scenario declares the coil voltage unavailable', () => {
      const scenario = values.scenarios.find((entry) => entry.scenarioId === 'open-solenoid-coil');
      expect(scenario.expectedUnavailableQuantities.length).toBeGreaterThan(0);
      expect(scenario.expectedUnavailableQuantities.join(' ')).toMatch(/coil-voltage/);
      expect(scenario.relayResolutionBasis).toBe('coil-element-absent');
    });

    test('no scenario expresses an unavailable quantity as a zero voltage', () => {
      for (const scenario of numericScenarios) {
        const unavailable = scenario.expectedUnavailableQuantities || [];
        if (unavailable.length === 0) continue;
        const nodeNames = scenario.nodeVoltagesV ? Object.keys(scenario.nodeVoltagesV) : [];
        for (const entry of unavailable) {
          expect(nodeNames).not.toContain(entry);
        }
      }
    });

    test('every declared node voltage is a finite number, and none is null', () => {
      for (const scenario of numericScenarios) {
        for (const [node, voltage] of Object.entries(scenario.nodeVoltagesV)) {
          expect({ node, finite: Number.isFinite(voltage) }).toEqual({ node, finite: true });
        }
      }
    });
  });

  describe('hand-authored ngspice decks', () => {
    const deckDir = path.join(root, 'engineering', 'ngspice');
    const decks = [
      'starting-system-v2-healthy.cir',
      'starting-system-v2-open-motor-feed.cir',
      'starting-system-v2-open-motor-ground.cir',
      'starting-system-v2-open-control.cir',
      'starting-system-v2-open-coil.cir'
    ];

    // Keys are the full SPICE element names exactly as declared in the decks.
    const spiceToTemplate = {
      RINT: { elementId: 'BAT1', parameterId: 'internalResistance' },
      RNEGCABLE: { connectionId: 'W_BAT_GND' },
      RFUSE: { elementId: 'FUSE1', parameterId: 'closedResistance' },
      RSWITCH: { elementId: 'SW1', parameterId: 'closedResistance' },
      RCOIL: { elementId: 'SOL_COIL', parameterId: 'coilResistance' },
      RCOILRETURN: { connectionId: 'W_SOL_COIL_GND' },
      RPOSCABLE: { connectionId: 'W_BAT_CONTACT' },
      RCONTACT: { elementId: 'SOL_CONTACT', parameterId: 'closedResistance' },
      RMOTORFEED: { connectionId: 'W_CONTACT_MOTOR' },
      RARMATURE: { elementId: 'MTR1', parameterId: 'armatureResistance' },
      RMOTORRETURN: { connectionId: 'W_MOTOR_GND' },
      VSRC: { elementId: 'BAT1', parameterId: 'sourceVoltage' }
    };

    function parseSpiceValue(raw) {
      const match = /^(-?\d+(?:\.\d+)?)([a-zA-Z]*)$/.exec(String(raw).trim());
      if (!match) return null;
      const scale = { '': 1, m: 1e-3, u: 1e-6, n: 1e-9, k: 1e3 }[match[2].toLowerCase()];
      if (scale === undefined) return null;
      return Number(match[1]) * scale;
    }

    function templateValue(target) {
      if (target.connectionId) {
        const conductor = template.conductorResistances
          .find((entry) => entry.connectionId === target.connectionId);
        return conductor ? conductor.resistanceOhm : null;
      }
      const parameter = template.elementParameters.find(
        (entry) => entry.elementId === target.elementId && entry.parameterId === target.parameterId
      );
      return parameter ? parameter.value : null;
    }

    test('all five decks exist and declare their provenance', () => {
      for (const deck of decks) {
        const source = fs.readFileSync(path.join(deckDir, deck), 'utf8');
        expect(source).toMatch(/INDEPENDENT reference fixture/);
        expect(source).toMatch(/12v-starting-system-v2\.json/);
        expect(source).toMatch(/\.control/);
      }
    });

    test('the healthy deck maps every template element by name', () => {
      const source = fs.readFileSync(path.join(deckDir, decks[0]), 'utf8');
      for (const origin of [
        'BAT1', 'FUSE1', 'SW1', 'SOL_COIL', 'SOL_CONTACT', 'MTR1',
        'W_BAT_GND', 'W_SOL_COIL_GND', 'W_BAT_CONTACT', 'W_CONTACT_MOTOR', 'W_MOTOR_GND'
      ]) {
        expect(source).toContain(origin);
      }
    });

    test('every deck declares values that match the template exactly', () => {
      for (const deck of decks) {
        const source = fs.readFileSync(path.join(deckDir, deck), 'utf8');
        const declared = source
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^[RV][A-Z]/.test(line))
          .map((line) => line.split(/\s+/));
        expect(declared.length).toBeGreaterThan(0);
        for (const parts of declared) {
          const name = parts[0].toUpperCase();
          const target = spiceToTemplate[name];
          expect({ deck, name, mapped: Boolean(target) }).toEqual({ deck, name, mapped: true });
          const expected = templateValue(target);
          const actual = parseSpiceValue(parts[parts.length - 1]);
          expect({ deck, name, actual, expected }).toEqual({ deck, name, actual, expected });
        }
      }
    });

    test('the healthy deck states the same delivered source current as the fixture', () => {
      const source = fs.readFileSync(path.join(deckDir, decks[0]), 'utf8');
      const scenario = values.scenarios.find((entry) => entry.scenarioId === 'healthy-crank');
      expect(source).toContain(String(scenario.sourceCurrentDeliveredA));
      expect(source).toMatch(/passive convention/);
    });
  });
});

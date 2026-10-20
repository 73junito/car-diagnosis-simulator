/**
 * @jest-environment node
 */

'use strict';

/**
 * Gate 2C-V independent ngspice comparison (T2a).
 *
 * Every expectation in this file comes from one of two independent sources: the
 * hand-calculated fixture, or the ngspice console simulator. The browser solver
 * is compared against both. No expectation is derived from the solver.
 *
 * If ngspice is unavailable the suite is skipped rather than substituted.
 * Set TORQUEMIND_NGSPICE_CONSOLE to point at a console executable.
 */

const fs = require('fs');
const path = require('path');

const simulation = require('../src/simulation');
const ngspice = require('./simulators/ngspice-runner');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const template = readJson('data/circuit-templates/12v-starting-system-v2.json');
const expectedNetlist = readJson('tests/simulators/starting-system-v2-expected-netlist.json');
const values = readJson('tests/simulators/starting-system-v2-expected-values.json');

const MODEL_REF = 'data/circuit-templates/12v-starting-system-v2.json';
const spice = expectedNetlist.spiceComparison;

/** ngspice prints about seven significant digits. */
const VOLTAGE_TOLERANCE_V = 1e-4;
const CURRENT_TOLERANCE_A = 1e-3;

const executable = ngspice.findNgspice();
const describeWithNgspice = executable ? describe : describe.skip;

if (!executable) {

  console.warn(
    '[ngspice] console executable not found; T2a comparison skipped. Set TORQUEMIND_NGSPICE_CONSOLE to enable.'
  );
}

const originByFixtureElementId = new Map(
  expectedNetlist.elements.map((element) => [element.elementId, element.templateOrigin])
);

function removedTemplateIds(scenario) {
  const removed = (scenario.removedElements ?? [])
    .map((elementId) => originByFixtureElementId.get(elementId))
    .filter((value) => typeof value === 'string');
  for (const faultId of scenario.faultIds ?? []) {
    for (const split of values.scenarioNodeSplits[faultId] ?? []) {
      removed.push(split.brokenConnectionId);
    }
  }
  return removed;
}

function solveScenario(scenario) {
  const translated = simulation.translateTemplate(template, {
    modelRef: MODEL_REF,
    operatingStateId: scenario.operatingStateId,
    removedElementIds: removedTemplateIds(scenario)
  });
  if (!translated.ok) throw new Error(`translation failed: ${translated.message}`);
  const solved = simulation.solveMna(translated.netlist);
  if (!solved.ok) throw new Error(`solve failed: ${solved.message}`);
  return { netlist: translated.netlist, solved };
}

/** Maps expected fixture node ids onto the translated netlist node ids. */
function inverseNodeMap(netlist) {
  const byTerminals = new Map(
    expectedNetlist.nodes.map((node) => [[...node.templateTerminals].sort().join('|'), node.nodeId])
  );
  const inverse = new Map();
  for (const node of netlist.nodes) {
    if (node.role === 'battery-internal') {
      inverse.set('N_BATINT', node.nodeId);
      continue;
    }
    if (node.nodeId === netlist.referenceNodeId) {
      inverse.set(expectedNetlist.referenceNodeId, node.nodeId);
      continue;
    }
    const expected = byTerminals.get([...node.terminals].sort().join('|'));
    if (expected) inverse.set(expected, node.nodeId);
  }
  return inverse;
}

function translatedElementFor(netlist, fixtureElementId) {
  const origin = originByFixtureElementId.get(fixtureElementId);
  const parameterId = expectedNetlist.elements.find(
    (element) => element.elementId === fixtureElementId
  ).parameterId;
  return netlist.elements.find(
    (element) =>
      `${element.templateOrigin}|${element.parameterId ?? ''}` === `${origin}|${parameterId ?? ''}`
  );
}

describeWithNgspice('independent ngspice comparison (T2a)', () => {
  test('the ngspice console executable is available and reports its version', () => {
    expect(executable).toBeTruthy();
    const version = ngspice.ngspiceVersion(executable);

    console.log(`[ngspice] executable=${executable} version=${version}`);
    expect(version).toMatch(/^ngspice-\d/);
  });

  for (const deck of spice.decks) {
    describe(`${deck.scenarioId} (${path.basename(deck.file)})`, () => {
      let parsed;
      let scenario;
      let solved;

      beforeAll(() => {
        const output = ngspice.runDeck(executable, path.join(root, deck.file));
        parsed = ngspice.parseOperatingPoint(output);
        scenario = values.scenarios.find((entry) => entry.scenarioId === deck.scenarioId);
        solved = solveScenario(scenario);
      });

      test('ngspice runs the deck without reporting an error', () => {
        expect(parsed.errors).toEqual([]);
        expect(Object.keys(parsed.values).length).toBeGreaterThan(0);
      });

      test('node voltages agree with the hand calculation and the browser solver', () => {
        const inverse = inverseNodeMap(solved.netlist);
        let compared = 0;
        for (const [spiceNode, expectedNode] of Object.entries(spice.nodeMap)) {
          const spiceValue = parsed.values[`v(${spiceNode})`];
          if (spiceValue === undefined) continue;
          const fixtureValue = scenario.nodeVoltagesV[expectedNode];
          if (fixtureValue === undefined) continue;

          const fixtureDelta = Math.abs(spiceValue - fixtureValue);
          expect({ deck: deck.scenarioId, node: expectedNode, within: fixtureDelta <= VOLTAGE_TOLERANCE_V })
            .toEqual({ deck: deck.scenarioId, node: expectedNode, within: true });

          const translatedNode = inverse.get(expectedNode);
          if (translatedNode !== undefined) {
            const solverDelta = Math.abs(spiceValue - solved.solved.nodeVoltageAbsolute[translatedNode]);
            expect({ deck: deck.scenarioId, node: expectedNode, solverWithin: solverDelta <= VOLTAGE_TOLERANCE_V })
              .toEqual({ deck: deck.scenarioId, node: expectedNode, solverWithin: true });
          }
          compared += 1;
        }
        expect(compared).toBeGreaterThan(0);
      });

      test('element currents agree with the hand calculation and the browser solver', () => {
        let compared = 0;
        for (const spiceName of Object.keys(spice.elementMap)) {
          // A voltage source current is read as i(vsrc), not @vsrc[i], and is
          // covered by the dedicated source-current tests below.
          if (spiceName.toUpperCase() === 'VSRC') continue;
          const fixtureElementId = spice.elementMap[spiceName];
          const spiceValue = parsed.values[`@${spiceName.toLowerCase()}[i]`];
          const fixtureValue = scenario.elementCurrentsA[fixtureElementId];

          if (spiceValue === undefined) {
            // The deck omits this element, which is how an open branch is
            // represented; the fixture must therefore record exactly zero.
            expect({ deck: deck.scenarioId, element: fixtureElementId, omitted: fixtureValue }).toEqual({
              deck: deck.scenarioId,
              element: fixtureElementId,
              omitted: 0
            });
            continue;
          }

          const fixtureDelta = Math.abs(spiceValue - fixtureValue);
          expect({ deck: deck.scenarioId, element: fixtureElementId, within: fixtureDelta <= CURRENT_TOLERANCE_A })
            .toEqual({ deck: deck.scenarioId, element: fixtureElementId, within: true });

          const translated = translatedElementFor(solved.netlist, fixtureElementId);
          if (translated) {
            const solverDelta = Math.abs(spiceValue - solved.solved.elementCurrent[translated.elementId]);
            expect({ deck: deck.scenarioId, element: fixtureElementId, solverWithin: solverDelta <= CURRENT_TOLERANCE_A })
              .toEqual({ deck: deck.scenarioId, element: fixtureElementId, solverWithin: true });
          }
          compared += 1;
        }
        expect(compared).toBeGreaterThan(0);
      });

      test('the source current sign convention agrees', () => {
        const spiceSource = parsed.values['i(vsrc)'];
        expect(spiceSource).toBeDefined();
        // SPICE reports current into the positive terminal, so a delivering
        // source is negative. The fixture records the same negative value.
        expect(Math.sign(spiceSource)).toBe(Math.sign(scenario.elementCurrentsA.E1));
        expect(Math.abs(spiceSource - scenario.elementCurrentsA.E1)).toBeLessThanOrEqual(
          CURRENT_TOLERANCE_A
        );
      });

      test('ngspice and the solver agree on the delivered source current', () => {
        const spiceDelivered = -parsed.values['i(vsrc)'];
        const solverSource = solved.netlist.elements.find(
          (element) => element.kind === 'ideal-voltage-source'
        );
        const solverDelivered = -solved.solved.elementCurrent[solverSource.elementId];
        expect(Math.abs(spiceDelivered - solverDelivered)).toBeLessThanOrEqual(CURRENT_TOLERANCE_A);
        expect(Math.abs(spiceDelivered - scenario.sourceCurrentDeliveredA)).toBeLessThanOrEqual(
          CURRENT_TOLERANCE_A
        );
      });
    });
  }
});

'use strict';

/**
 * Gate 2C electrical solver validation.
 *
 * Every numerical expectation in this file comes from an independently authored
 * source: the hand-calculated expected-values fixture, or a hand-authored
 * ngspice deck. No expectation is derived from the solver under test.
 */

const fs = require('fs');
const path = require('path');

const simulation = require('../src/simulation');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const template = readJson('data/circuit-templates/12v-starting-system-v2.json');
const expectedNetlist = readJson('tests/simulators/starting-system-v2-expected-netlist.json');
const values = readJson('tests/simulators/starting-system-v2-expected-values.json');

const MODEL_REF = 'data/circuit-templates/12v-starting-system-v2.json';

const originByFixtureElementId = new Map(
  expectedNetlist.elements.map((element) => [element.elementId, element.templateOrigin])
);

/** Removal ids, in template vocabulary, for a scenario. */
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

function translateFor(scenario) {
  const result = simulation.translateTemplate(template, {
    modelRef: MODEL_REF,
    operatingStateId: scenario.operatingStateId,
    removedElementIds: removedTemplateIds(scenario)
  });
  if (!result.ok) throw new Error(`translation failed for ${scenario.scenarioId}: ${result.message}`);
  return result.netlist;
}

/** Maps translated node ids onto the fixture's expected node ids. */
function nodeMap(netlist) {
  const byTerminals = new Map(
    expectedNetlist.nodes.map((node) => [[...node.templateTerminals].sort().join('|'), node.nodeId])
  );
  const map = new Map();
  for (const node of netlist.nodes) {
    if (node.role === 'battery-internal') {
      map.set(node.nodeId, 'N_BATINT');
      continue;
    }
    if (node.nodeId === netlist.referenceNodeId) {
      map.set(node.nodeId, expectedNetlist.referenceNodeId);
      continue;
    }
    const expected = byTerminals.get([...node.terminals].sort().join('|'));
    if (expected) map.set(node.nodeId, expected);
  }
  return map;
}

const numericScenarios = values.scenarios.filter((scenario) => scenario.expectedValues !== null);
const scenarioById = (scenarioId) => values.scenarios.find((entry) => entry.scenarioId === scenarioId);

describe('electrical solver: template translation', () => {
  const healthy = () => translateFor(scenarioById('healthy-crank'));

  test('reproduces the hand-authored node structure exactly', () => {
    const map = nodeMap(healthy());
    expect([...map.values()].sort()).toEqual(
      expectedNetlist.nodes
        .filter((node) => node.variantOnly !== true)
        .map((node) => node.nodeId)
        .sort()
    );
  });

  test('keeps declared conductor resistances as branches and merges only ideal conductors', () => {
    const conductorElements = healthy().elements.filter((element) => element.kind === 'conductor');
    expect(conductorElements.map((element) => element.templateOrigin).sort()).toEqual([
      'W_BAT_CONTACT',
      'W_BAT_GND',
      'W_CONTACT_MOTOR',
      'W_MOTOR_GND',
      'W_SOL_COIL_GND'
    ]);
    // The three ideal conductors merged their terminals, so neither endpoint
    // survives as a separate node.
    const map = nodeMap(healthy());
    expect([...map.values()]).toContain('N_BATPOS');
    expect([...map.values()]).toContain('N_FUSE_OUT');
    expect([...map.values()]).toContain('N_CTRL');
  });

  test('declares every element exactly once with the fixture topology and values', () => {
    const netlist = healthy();
    const map = nodeMap(netlist);
    expect(netlist.elements).toHaveLength(expectedNetlist.elements.length);

    for (const expected of expectedNetlist.elements) {
      const key = `${expected.templateOrigin}|${expected.parameterId ?? ''}`;
      const actual = netlist.elements.find(
        (element) => `${element.templateOrigin}|${element.parameterId ?? ''}` === key
      );
      expect({ key, found: Boolean(actual) }).toEqual({ key, found: true });
      expect({ key, from: map.get(actual.fromNode), to: map.get(actual.toNode) }).toEqual({
        key,
        from: expected.fromNode,
        to: expected.toNode
      });
      if (expected.resistanceOhm !== undefined) {
        expect({ key, r: actual.resistanceOhm }).toEqual({ key, r: expected.resistanceOhm });
      }
      if (expected.value !== undefined) {
        expect({ key, v: actual.sourceVoltageV }).toEqual({ key, v: expected.value });
      }
    }
  });

  test('is deterministic across repeated translations', () => {
    const first = JSON.stringify(healthy());
    const second = JSON.stringify(healthy());
    expect(second).toBe(first);
  });

  test('an open control conductor splits the merged node instead of merging it', () => {
    const map = nodeMap(translateFor(scenarioById('open-control-circuit')));
    const mapped = [...map.values()];
    expect(mapped).toContain('N_SW_OUT');
    expect(mapped).toContain('N_COIL_PWR');
    expect(mapped).not.toContain('N_CTRL');
  });

  test('an open relay contact removes the contact branch', () => {
    const netlist = translateFor(scenarioById('open-control-circuit'));
    expect(netlist.elements.some((element) => element.templateOrigin === 'SOL_CONTACT')).toBe(false);
  });

  test('refuses a template with no reference node', () => {
    const result = simulation.translateTemplate(
      { templateId: 't', templateVersion: '2.0.0', components: [], connections: [] },
      { modelRef: MODEL_REF, operatingStateId: 'crank' }
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NO_REFERENCE_NODE');
  });

  test('refuses a cross-domain path with no modelled converter', () => {
    const twoDomain = JSON.parse(JSON.stringify(template));
    twoDomain.voltageSystems.push({
      id: 'TR400',
      systemType: 'traction',
      nominalVoltage: 400,
      unit: 'V DC',
      displayLabel: '400 V nominal'
    });
    twoDomain.connections.find((entry) => entry.id === 'W_BAT_GND').voltageSystemId = 'TR400';
    const result = simulation.translateTemplate(twoDomain, {
      modelRef: MODEL_REF,
      operatingStateId: 'crank'
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('CROSS_DOMAIN_PATH');
  });

  test('excludes network and signal conductors from the DC solve without calling them non-conductive', () => {
    const withNetwork = JSON.parse(JSON.stringify(template));
    withNetwork.components.push({
      id: 'CAN_A',
      type: 'module',
      voltageSystemId: 'LV12',
      terminals: [{ id: 'CAN_A_H' }, { id: 'CAN_A_L' }]
    });
    withNetwork.connections.push({
      id: 'W_CAN_H',
      from: 'CAN_A_H',
      to: 'GATEWAY1_H',
      type: 'CAN',
      styleId: 'electrical.can-bus',
      voltageSystemId: 'LV12'
    });
    const result = simulation.translateTemplate(withNetwork, {
      modelRef: MODEL_REF,
      operatingStateId: 'crank'
    });
    expect(result.ok).toBe(true);
    const excluded = result.netlist.excludedElements.find(
      (element) => element.templateOrigin === 'W_CAN_H'
    );
    expect(excluded).toBeDefined();
    expect(excluded.physicalContinuity).toBe('galvanic');
    expect(excluded.dcModelApplicability).toBe('excluded-by-domain');
    expect(excluded.requiredDomainAdapter).toBe('network-control');
  });
});

describe('electrical solver: numerical agreement with hand calculations', () => {
  for (const scenario of numericScenarios) {
    test(`${scenario.scenarioId}: node voltages match the hand calculation`, () => {
      const netlist = translateFor(scenario);
      const solved = simulation.solveMna(netlist);
      expect(solved.ok).toBe(true);

      const inverse = new Map([...nodeMap(netlist).entries()].map(([translated, expected]) => [expected, translated]));
      for (const [expectedNode, expectedVoltage] of Object.entries(scenario.nodeVoltagesV)) {
        const translatedNode = inverse.get(expectedNode);
        expect({ node: expectedNode, present: Boolean(translatedNode) }).toEqual({
          node: expectedNode,
          present: true
        });
        expect(
          Math.abs((solved.nodeVoltageAbsolute[translatedNode] ?? Number.NaN) - expectedVoltage)
        ).toBeLessThanOrEqual(values.tolerance.nodeVoltageV);
      }
    });

    test(`${scenario.scenarioId}: element currents match the hand calculation`, () => {
      const netlist = translateFor(scenario);
      const solved = simulation.solveMna(netlist);
      expect(solved.ok).toBe(true);

      for (const [fixtureElementId, expectedCurrent] of Object.entries(scenario.elementCurrentsA)) {
        const origin = originByFixtureElementId.get(fixtureElementId);
        const parameterId = expectedNetlist.elements.find(
          (element) => element.elementId === fixtureElementId
        ).parameterId ?? '';
        const element = netlist.elements.find(
          (candidate) =>
            `${candidate.templateOrigin}|${candidate.parameterId ?? ''}` === `${origin}|${parameterId}`
        );
        if (!element) {
          // A branch removed by the fault carries exactly zero current.
          expect({ fixtureElementId, expectedCurrent }).toEqual({
            fixtureElementId,
            expectedCurrent: 0
          });
          continue;
        }
        expect(
          Math.abs((solved.elementCurrent[element.elementId] ?? Number.NaN) - expectedCurrent)
        ).toBeLessThanOrEqual(values.tolerance.branchCurrentA);
      }
    });

    test(`${scenario.scenarioId}: every node is determinate and the residual is within tolerance`, () => {
      const netlist = translateFor(scenario);
      const solved = simulation.solveMna(netlist);
      expect(solved.ok).toBe(true);
      expect(solved.indeterminateNodes).toEqual([]);
      expect(solved.residuals.infinityNorm).toBeLessThanOrEqual(solved.residuals.tolerance);
    });

    test(`${scenario.scenarioId}: source current matches the declared delivered current`, () => {
      const netlist = translateFor(scenario);
      const solved = simulation.solveMna(netlist);
      expect(solved.ok).toBe(true);
      const source = netlist.elements.find((element) => element.kind === 'ideal-voltage-source');
      // The fixture records the current from the element's from-node through the
      // element, which is negative for a delivering source.
      expect(
        Math.abs(-(solved.elementCurrent[source.elementId] ?? Number.NaN) - scenario.sourceCurrentDeliveredA)
      ).toBeLessThanOrEqual(values.tolerance.branchCurrentA);
    });
  }

  test('power balance closes against the hand calculation', () => {
    const scenario = scenarioById('healthy-crank');
    const netlist = translateFor(scenario);
    const solved = simulation.solveMna(netlist);
    expect(solved.ok).toBe(true);

    let resistive = 0;
    for (const element of netlist.elements) {
      if (element.resistanceOhm === null || element.resistanceOhm <= 0) continue;
      const current = solved.elementCurrent[element.elementId] ?? 0;
      resistive += current * current * element.resistanceOhm;
    }
    expect(resistive).toBeCloseTo(scenario.powerBalance.resistiveAbsorbedW, 1);
  });

  test('solving twice yields bit-identical results', () => {
    const netlist = translateFor(scenarioById('healthy-crank'));
    const first = JSON.stringify(simulation.solveMna(netlist));
    const second = JSON.stringify(simulation.solveMna(netlist));
    expect(second).toBe(first);
  });
});

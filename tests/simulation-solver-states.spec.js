'use strict';

/**
 * Gate 2C solver state, relay coupling and worker-execution tests.
 *
 * These tests assert the contract-level behaviour that distinguishes a valid
 * zero from an indeterminate value, a numerical failure from an execution
 * failure, and a resolved relay state from an unresolved one.
 */

const fs = require('fs');
const path = require('path');

const simulation = require('../src/simulation');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));

const template = readJson('data/circuit-templates/12v-starting-system-v2.json');
const MODEL_REF = 'data/circuit-templates/12v-starting-system-v2.json';

/** Builds a minimal netlist IR directly, for hand-built topologies. */
function makeNetlist(referenceNodeId, nodeIds, elements) {
  return {
    modelRef: 'synthetic',
    templateId: 'synthetic',
    templateVersion: '2.0.0',
    referenceNodeId,
    nodes: nodeIds.map((nodeId) => ({
      nodeId,
      role: nodeId === referenceNodeId ? 'reference' : 'terminal-derived',
      terminals: [nodeId]
    })),
    elements,
    excludedElements: [],
    warnings: [],
    terminalToNode: Object.fromEntries(nodeIds.map((nodeId) => [nodeId, nodeId]))
  };
}

function resistor(elementId, fromNode, toNode, resistanceOhm) {
  return {
    elementId,
    kind: 'resistor',
    fromNode,
    toNode,
    templateOrigin: elementId,
    parameterId: null,
    resistanceOhm,
    sourceVoltageV: null,
    positiveNode: null,
    voltageSystemId: 'LV12'
  };
}

function source(elementId, positiveNode, negativeNode, sourceVoltageV) {
  return {
    elementId,
    kind: 'ideal-voltage-source',
    fromNode: positiveNode,
    toNode: negativeNode,
    templateOrigin: elementId,
    parameterId: null,
    resistanceOhm: null,
    sourceVoltageV,
    positiveNode,
    voltageSystemId: 'LV12'
  };
}

describe('solver failure states', () => {
  test('two conflicting ideal sources produce a singular system with null residuals', () => {
    const netlist = makeNetlist('N_REF', ['N_REF', 'N_A'], [
      source('V1', 'N_A', 'N_REF', 12),
      source('V2', 'N_A', 'N_REF', 6)
    ]);
    const solved = simulation.solveMna(netlist);
    expect(solved.ok).toBe(false);
    expect(solved.code).toBe('SINGULAR_MATRIX');
    expect(solved.stage).toBe('factorization');
    expect(solved.axis).toBe('numerical');
    // No valid solution exists, so no residual may be reported.
    expect(solved.residuals).toBeNull();
  });

  test('a voltage source shorted by an ideal conductor is refused, not solved', () => {
    const netlist = makeNetlist('N_REF', ['N_REF', 'N_A'], [source('V1', 'N_REF', 'N_REF', 12)]);
    const solved = simulation.solveMna(netlist);
    expect(solved.ok).toBe(false);
    expect(solved.code).toBe('SINGULAR_MATRIX');
    expect(solved.residuals).toBeNull();
  });

  test('a passive unreferenced island is indeterminate in absolute potential but zero in current', () => {
    const netlist = makeNetlist('N_REF', ['N_REF', 'N_A', 'N_F1', 'N_F2'], [
      resistor('R1', 'N_A', 'N_REF', 10),
      source('V1', 'N_A', 'N_REF', 12),
      resistor('R2', 'N_F1', 'N_F2', 5)
    ]);
    const solved = simulation.solveMna(netlist);
    expect(solved.ok).toBe(true);
    expect(solved.indeterminateNodes.sort()).toEqual(['N_F1', 'N_F2']);
    // Absolute potential of an unreferenced island is undefined.
    expect(solved.nodeVoltageAbsolute.N_F1).toBeUndefined();
    expect(solved.nodeVoltageAbsolute.N_F2).toBeUndefined();
    // Internal differences and currents are proved, not assumed.
    expect(solved.islandRelativeVoltage.N_F1).toBe(0);
    expect(solved.islandRelativeVoltage.N_F2).toBe(0);
    expect(solved.elementCurrent.R2).toBe(0);
    // The reference component is unaffected and determinate.
    expect(solved.nodeVoltageAbsolute.N_A).toBeCloseTo(12, 9);
  });

  test('a referenced network is fully determinate', () => {
    const netlist = makeNetlist('N_REF', ['N_REF', 'N_A'], [
      source('V1', 'N_A', 'N_REF', 12),
      resistor('R1', 'N_A', 'N_REF', 6)
    ]);
    const solved = simulation.solveMna(netlist);
    expect(solved.ok).toBe(true);
    expect(solved.indeterminateNodes).toEqual([]);
    expect(solved.elementCurrent.R1).toBeCloseTo(2, 9);
    expect(solved.elementCurrent.V1).toBeCloseTo(-2, 9);
  });

  test('a netlist whose reference node is missing is refused at assembly', () => {
    const netlist = makeNetlist('N_REF', ['N_A'], [resistor('R1', 'N_A', 'N_A', 1)]);
    const solved = simulation.solveMna(netlist);
    expect(solved.ok).toBe(false);
    expect(solved.code).toBe('NO_REFERENCE_NODE');
    expect(solved.stage).toBe('assembly');
    expect(solved.residuals).toBeNull();
  });
});

const manifest = {
  manifestId: 'manifest.starting-system.v2',
  modelId: 'automotive-12v-starting-system',
  modelVersion: '2.0.0',
  schemaVersion: '1.0.0',
  status: 'in-development',
  primaryDomainId: 'electrical',
  coupledDomainIds: ['mechanical'],
  applicability: { mode: 'generic-training-only', vehicleSpecific: false, notice: 'training only' },
  capabilities: [
    {
      capabilityId: 'electrical.dc',
      domainId: 'electrical',
      measurementTypes: ['voltage', 'voltage_drop', 'current', 'power', 'continuity', 'command_state'],
      status: 'in-development',
      validationRefs: [],
      limitations: []
    }
  ],
  unsupportedMeasurementTypes: [],
  simplifications: ['the starter motor is modelled as a pure resistance'],
  dependencies: [],
  provenance: { evidenceRole: 'project_authored_training_model', authoritativeSpecification: false }
};

const capability = {
  domainId: 'electrical',
  status: 'in-development',
  supportedMeasurementTypes: ['voltage', 'voltage_drop', 'current', 'power', 'continuity', 'command_state'],
  unsupportedMeasurementTypes: ['waveform', 'diagnostic_data'],
  reportsResiduals: true,
  distinguishesUnavailableFromZero: true,
  limitations: []
};

function buildAdapter() {
  return simulation.createElectricalAdapter({
    manifest,
    capability,
    template,
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    modelRef: MODEL_REF,
    operatingStates: [
      {
        stateId: 'crank',
        label: 'Crank request',
        elementStates: [{ elementId: 'SW1', actuation: 'closed', basis: 'operator-actuation' }]
      }
    ],
    faultScenarios: template.faultCatalog.map((fault) => ({
      scenarioId: fault.id,
      label: fault.label,
      faultClassId: fault.faultClassId,
      targetElementId: fault.targetConnectionId ?? fault.targetComponentId ?? ''
    })),
    relayCouplings: template.relayCouplings,
    declaredToolIds: ['tool.dmm', 'tool.current-clamp'],
    toolMeasurementTypes: {
      'tool.dmm': ['voltage', 'voltage_drop', 'resistance', 'continuity', 'frequency', 'duty_cycle'],
      'tool.current-clamp': ['current', 'waveform']
    },
    engineLabel: 'mna-test'
  });
}

function makeRequest(scenarioId, faultIds, measurementRequests) {
  return {
    requestId: `req-${scenarioId}`,
    labId: 'starting-system-lab',
    manifestId: manifest.manifestId,
    modelId: manifest.modelId,
    modelVersion: manifest.modelVersion,
    modelRef: MODEL_REF,
    operatingStateId: 'crank',
    faultScenarioIds: faultIds,
    measurementRequests
  };
}

const voltageAt = (testPointId) => ({
  measurementId: `m-${testPointId}`,
  measurementType: 'voltage',
  kind: 'node-voltage',
  fromTerminalId: testPointId,
  toolId: 'tool.dmm'
});

const resolvedById = (result) =>
  Object.fromEntries(result.quantities.map((quantity) => [quantity.measurementId, quantity.resolved]));

describe('electrical adapter: end-to-end fault signatures', () => {
  test('healthy crank: control point below battery, motor ground near reference', () => {
    const result = buildAdapter().solve(
      makeRequest('healthy', [], [voltageAt('TP_START_CMD'), voltageAt('TP_SOLENOID_OUT')])
    );
    expect(result.ok).toBe(true);
    const values = resolvedById(result);
    expect(values['m-TP_START_CMD'].value).toBeCloseTo(10.77525, 4);
    expect(values['m-TP_SOLENOID_OUT'].value).toBeCloseTo(10.553903, 4);
  });

  test('power-side open: solenoid output at battery voltage, motor ground a proved zero', () => {
    const result = buildAdapter().solve(
      makeRequest('open-power', ['FAULT_OPEN_POWER'], [
        voltageAt('TP_SOLENOID_OUT'),
        voltageAt('TP_MOTOR_GND')
      ])
    );
    expect(result.ok).toBe(true);
    const values = resolvedById(result);
    expect(values['m-TP_SOLENOID_OUT'].value).toBeCloseTo(12.564013, 4);
    expect(values['m-TP_MOTOR_GND'].state).toBe('solved');
    expect(values['m-TP_MOTOR_GND'].value).toBe(0);
  });

  test('open control: the derived contact opens and the whole motor path is dead', () => {
    const result = buildAdapter().solve(
      makeRequest('open-control', ['FAULT_OPEN_CONTROL'], [
        voltageAt('TP_START_CMD'),
        voltageAt('TP_SOLENOID_OUT')
      ])
    );
    expect(result.ok).toBe(true);
    const values = resolvedById(result);
    expect(values['m-TP_START_CMD'].value).toBeCloseTo(12.6, 4);
    expect(values['m-TP_SOLENOID_OUT'].value).toBe(0);
  });

  test('open solenoid coil: the contact fails closed and the motor path is dead', () => {
    const result = buildAdapter().solve(
      makeRequest('open-coil', ['FAULT_OPEN_COIL'], [voltageAt('TP_SOLENOID_OUT')])
    );
    expect(result.ok).toBe(true);
    expect(result.quantities[0].resolved.value).toBe(0);
  });
});

describe('electrical adapter: declared refusals and provenance', () => {
  test('a graded resistance fault with no declared magnitude is refused, not invented', () => {
    const result = buildAdapter().solve(makeRequest('high-res', ['FAULT_HIGH_RES_POWER'], []));
    expect(result.ok).toBe(false);
    expect(result.failure.code).toBe('TOPOLOGY_UNSUPPORTED');
    expect(result.failure.axis).toBe('physical');
    expect(result.failure.residuals).toBeNull();
    expect(result.failure.message).toMatch(/no magnitude is declared/);
  });

  test('an undeclared instrument cannot produce a reading', () => {
    const result = buildAdapter().solve(
      makeRequest('tool', [], [
        {
          measurementId: 'm-osc',
          measurementType: 'voltage',
          kind: 'node-voltage',
          fromTerminalId: 'TP_BAT_POS',
          toolId: 'tool.oscilloscope'
        }
      ])
    );
    expect(result.ok).toBe(true);
    expect(result.quantities[0].resolved.state).toBe('unavailable');
    expect(result.quantities[0].resolved.reason).toMatch(/not declared/);
  });

  test('a current request without a resolvable branch is refused', () => {
    const result = buildAdapter().solve(
      makeRequest('current', [], [
        {
          measurementId: 'm-i',
          measurementType: 'current',
          kind: 'branch-current',
          fromTerminalId: 'TP_BAT_POS',
          toTerminalId: 'TP_MOTOR_GND',
          toolId: 'tool.current-clamp'
        }
      ])
    );
    expect(result.ok).toBe(true);
    expect(result.quantities[0].resolved.state).toBe('unavailable');
    expect(result.quantities[0].resolved.reason).toMatch(/named branch/);
  });

  test('a branch current is derived from the element law and matches the hand calculation', () => {
    const result = buildAdapter().solve(
      makeRequest('branch', [], [
        {
          measurementId: 'm-coil',
          measurementType: 'current',
          kind: 'branch-current',
          branchId: 'SOL_COIL',
          toolId: 'tool.current-clamp'
        }
      ])
    );
    expect(result.ok).toBe(true);
    expect(result.quantities[0].resolved.value).toBeCloseTo(3.591152, 4);
  });

  test('every quantity carries provenance, precision separation and operating-condition validity', () => {
    const result = buildAdapter().solve(makeRequest('prov', [], [voltageAt('TP_BAT_POS')]));
    expect(result.ok).toBe(true);
    const quantity = result.quantities[0];
    expect(quantity.sourceRole).toBe('simulation-derived');
    expect(quantity.conditionClass).toBe('operating-condition');
    expect(quantity.validity.conditionClass).toBe('operating-condition');
    expect(quantity.provenance.solverVersion).toBe(simulation.ELECTRICAL_SOLVER_VERSION);
    expect(quantity.provenance.templateVersion).toBe('2.0.0');
    expect(quantity.provenance.engine).toBe('mna-test');
    // No applicable source supplies an instrument accuracy, so none is claimed.
    expect(quantity.precision.instrumentAccuracy).toBeNull();
    expect(quantity.precision.accuracyUnavailableReason).toMatch(/no applicable source reference/i);
    expect(quantity.precision.numericalTolerance.basis).toBe('solver-contract');
    expect(result.provenance.deterministic).toBe(true);
    expect(result.residuals.infinityNorm).toBeLessThanOrEqual(result.residuals.tolerance);
  });

  test('the adapter declares its capability and exposes no routing', () => {
    const adapter = buildAdapter();
    expect(adapter.adapterId).toBe('electrical-circuit');
    expect(adapter.domainId).toBe('electrical');
    expect(adapter.capability.reportsResiduals).toBe(true);
    expect(adapter.capability.distinguishesUnavailableFromZero).toBe(true);
    expect(adapter.listRelayCouplings()).toHaveLength(1);
    expect(adapter.listOperatingStates()).toHaveLength(1);
    expect(adapter.listFaultScenarios().length).toBeGreaterThanOrEqual(5);
  });

  test('an unsupported measurement kind returns an explicit unavailable result, never a number', () => {
    const result = buildAdapter().solve(
      makeRequest('waveform', [], [
        {
          measurementId: 'm-wave',
          measurementType: 'voltage',
          kind: 'waveform',
          branchId: 'SOL_COIL',
          toolId: 'tool.current-clamp'
        }
      ])
    );
    expect(result.ok).toBe(true);
    const resolved = result.quantities[0].resolved;
    expect(resolved.state).toBe('unavailable');
    expect(resolved.value).toBeUndefined();
    expect(resolved.reason).toMatch(/not modelled by the electrical engine/);
  });

  test('a simulated cranking condition stays separate from the 500 A fixed-current reference', () => {
    const catalog = readJson(
      'data/engineering/authoritative-specifications/delco-remy-starting-charging.json'
    );
    const testLoad = catalog.specifications.find(
      (spec) => spec.id === 'delco-starter-cable-test-load-12v'
    );
    // The reference test condition is exact: 500 A at 12 V, carbon-pile method.
    expect(testLoad.comparison).toBe('exact');
    expect(testLoad.quantity.value).toBe(500);

    const result = buildAdapter().solve(makeRequest('gate', [], [voltageAt('TP_BAT_POS')]));
    expect(result.ok).toBe(true);
    const quantity = result.quantities[0];
    // A simulated operating condition is never a test-condition measurement, so
    // it can never be compared against the fixed-current reference limit.
    expect(quantity.conditionClass).toBe('operating-condition');
    expect(quantity.validity.conditionClass).toBe('operating-condition');
    expect(quantity.validity.notes).toMatch(/not a test-condition measurement/i);
    expect(quantity.validity.notes).toMatch(/not comparable with a fixed-current reference limit/i);
  });
});

describe('relay coil and contact coupling', () => {
  const couplings = template.relayCouplings;
  const solve = (removedElementIds) =>
    simulation.solveWithRelayCoupling({
      template,
      modelRef: MODEL_REF,
      operatingStateId: 'crank',
      removedElementIds,
      relayCouplings: couplings
    });

  test('an energised coil closes the contact from the solved coil voltage', () => {
    const outcome = solve([]);
    expect(outcome.ok).toBe(true);
    expect(outcome.relay.state).toBe('closed');
    expect(outcome.relay.basis).toBe('coil-voltage-above-pickup');
    expect(outcome.relay.coilVoltageV).toBeCloseTo(10.77345, 3);
  });

  test('an open control circuit de-energises the coil and opens the contact', () => {
    const outcome = solve(['W_SWITCH_SOL']);
    expect(outcome.ok).toBe(true);
    expect(outcome.relay.state).toBe('open');
    expect(outcome.relay.basis).toBe('coil-voltage-below-hold');
  });

  test('an absent coil de-energizes the contact, leaving it electrically open, and reports the coil voltage as null', () => {
    const outcome = solve(['SOL_COIL']);
    expect(outcome.ok).toBe(true);
    expect(outcome.relay.state).toBe('open');
    expect(outcome.relay.basis).toBe('coil-element-absent');
    expect(outcome.relay.coilVoltageV).toBeNull();
  });

  test('an open coil or an open control circuit leaves the main contact electrically OPEN', () => {
    for (const removed of [['SOL_COIL'], ['W_SWITCH_SOL']]) {
      const outcome = solve(removed);
      expect(outcome.ok).toBe(true);
      expect({ removed: removed.join(','), state: outcome.relay.state }).toEqual({
        removed: removed.join(','),
        state: 'open'
      });
      // The main contact branch must be absent from the netlist, which is what
      // "electrically open" means here: no conductive path through the contact.
      expect(
        outcome.netlist.elements.some((element) => element.templateOrigin === 'SOL_CONTACT')
      ).toBe(false);
    }
  });

  test('the coupling declares an unambiguous failure behaviour, not a closed contact', () => {
    const coupling = template.relayCouplings[0];
    expect(coupling.failureBehaviour).toBe('de-energized-contact-open');
    // Guard against the earlier wording, which could be misread as a closed contact.
    expect(JSON.stringify(template)).not.toContain('fail-closed-contact-open');
    expect(coupling.dynamicsNotice).toMatch(/not modelled/i);
  });

  test('a coupling that cannot converge is reported as unresolved', () => {
    // The contact shorts the coil control node to the reference when closed, so
    // closing the contact removes the very voltage that energised the coil.
    const oscillating = {
      templateId: 'synthetic-relay-oscillator',
      templateVersion: '2.0.0',
      components: [
        {
          id: 'BAT1',
          type: 'battery',
          voltageSystemId: 'LV12',
          terminals: [{ id: 'BAT1_POS' }, { id: 'BAT1_NEG' }]
        },
        {
          id: 'SW1',
          type: 'switch',
          voltageSystemId: 'LV12',
          terminals: [{ id: 'SW1_IN' }, { id: 'SW1_OUT' }],
          internalConnections: [['SW1_IN', 'SW1_OUT']]
        },
        {
          id: 'COIL',
          type: 'actuator',
          voltageSystemId: 'LV12',
          terminals: [{ id: 'COIL_A' }, { id: 'COIL_B' }],
          internalConnections: [['COIL_A', 'COIL_B']]
        },
        {
          id: 'CONTACT',
          type: 'relay',
          voltageSystemId: 'LV12',
          terminals: [{ id: 'C_A' }, { id: 'C_B' }],
          internalConnections: [['C_A', 'C_B']]
        },
        { id: 'GND1', type: 'ground', voltageSystemId: 'LV12', terminals: [{ id: 'GND_MAIN' }] }
      ],
      connections: [
        { id: 'W1', from: 'BAT1_POS', to: 'SW1_IN', type: 'power_feed', voltageSystemId: 'LV12' },
        { id: 'W2', from: 'SW1_OUT', to: 'COIL_A', type: 'control', voltageSystemId: 'LV12' },
        { id: 'W3', from: 'COIL_B', to: 'GND_MAIN', type: 'ground_reference', voltageSystemId: 'LV12' },
        { id: 'W4', from: 'BAT1_POS', to: 'C_A', type: 'power_feed', voltageSystemId: 'LV12' },
        { id: 'W5', from: 'C_B', to: 'GND_MAIN', type: 'control', voltageSystemId: 'LV12' },
        { id: 'W6', from: 'BAT1_NEG', to: 'GND_MAIN', type: 'ground_reference', voltageSystemId: 'LV12' }
      ],
      elementParameters: [
        { elementId: 'BAT1', parameterId: 'sourceVoltage', value: 12 },
        { elementId: 'BAT1', parameterId: 'internalResistance', value: 0.01 },
        { elementId: 'SW1', parameterId: 'closedResistance', value: 0.001 },
        { elementId: 'COIL', parameterId: 'coilResistance', value: 10 },
        { elementId: 'CONTACT', parameterId: 'closedResistance', value: 0.001 }
      ],
      conductorResistances: [{ connectionId: 'W3', resistanceOhm: 0.001 }],
      elementStates: [
        { stateId: 'on', independentlyActuatedElements: [{ elementId: 'SW1', actuation: 'closed' }] }
      ]
    };

    const outcome = simulation.solveWithRelayCoupling({
      template: oscillating,
      modelRef: 'synthetic',
      operatingStateId: 'on',
      removedElementIds: [],
      relayCouplings: [
        {
          couplingId: 'C1',
          coilElementId: 'COIL',
          contactElementId: 'CONTACT',
          coilControlNode: 'COIL_A',
          coilReturnNode: 'COIL_B',
          pickupVoltageV: 5,
          holdVoltageV: 2,
          model: 'threshold-on-solved-coil-voltage',
          dynamics: 'quasi-static-declared',
          dynamicsNotice: 'synthetic oscillator used to exercise non-convergence',
          parameterProvenance: 'project-authored-training-value'
        }
      ]
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.failure.code).toBe('RELAY_STATE_UNRESOLVED');
    expect(outcome.failure.axis).toBe('numerical');
    expect(outcome.failure.stage).toBe('solve');
    expect(outcome.failure.residuals).toBeNull();
  });
});

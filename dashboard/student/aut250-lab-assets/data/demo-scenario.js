/**
 * AUT-250 Interactive Laboratory Assets — ILLUSTRATIVE DEMONSTRATION INPUT.
 *
 * This file exists only to exercise the asset components in the standalone
 * showcase. Every value here is INVENTED FOR DEMONSTRATION and is NOT a
 * vehicle measurement, an OEM specification, a real diagnostic trouble code,
 * a tolerance, or a diagnostic conclusion.
 *
 * Production use must supply equivalent payloads from the approved external
 * scenario data provider (see INTEGRATION.md).
 *
 * UMD: window.Aut250DemoScenario and require().
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Aut250DemoScenario = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  /**
   * Deterministic training waveform: a rising primary-current ramp with a
   * hold phase and a switch-off decay. It illustrates a waveform SHAPE only.
   * No sample is derived from, or attributed to, any real vehicle.
   */
  function buildIllustrativePrimaryCurrent() {
    var samples = [];
    for (var t = 0; t <= 20; t += 0.5) {
      var value;
      if (t <= 2.5) {
        value = (t / 2.5) * 6;
      } else if (t <= 5) {
        value = 6 - ((t - 2.5) / 2.5) * 1.5;
      } else if (t <= 5.5) {
        value = 4.5 * (1 - ((t - 5) / 0.5));
      } else {
        value = 0;
      }
      samples.push({ t: Math.round(t * 100) / 100, v: Math.round(value * 1000) / 1000 });
    }
    return samples;
  }

  function buildIllustrativeChannelVoltage() {
    var samples = [];
    for (var t = 0; t <= 20; t += 1) {
      samples.push({ t: t, v: Math.round((1.2 * Math.sin(t / 3)) * 1000) / 1000 });
    }
    return samples;
  }

  var payload = {
    contractVersion: '0.1.0',
    source: {
      kind: 'illustrative-demo',
      illustrative: true,
      label: 'Standalone showcase demo input',
      notice: 'Invented for demonstration. Not a measurement, specification, or diagnostic conclusion.'
    },
    multimeter: {
      measurements: [
        {
          id: 'demo-supply-voltage',
          label: 'Illustrative supply voltage (demo)',
          mode: 'dc-voltage',
          value: 12.62,
          unit: 'V',
          quality: 'demo-value',
          testPoint: { componentId: 'demo-battery', terminalId: 'positive' }
        },
        {
          id: 'demo-coil-resistance',
          label: 'Illustrative coil winding resistance (demo)',
          mode: 'resistance',
          value: 0.8,
          unit: 'ohm',
          quality: 'demo-value',
          testPoint: { componentId: 'demo-ignition-coil', terminalId: 'primary-a' }
        },
        {
          id: 'demo-ground-continuity',
          label: 'Illustrative ground continuity (demo)',
          mode: 'continuity',
          continuity: 'closed',
          resistanceOhm: 0.4,
          quality: 'demo-value',
          testPoint: { componentId: 'demo-ground', terminalId: 'chassis' }
        }
      ]
    },
    oscilloscope: {
      channels: [
        {
          id: 'demo-primary-current',
          label: 'Illustrative primary ignition coil current (demo shape)',
          unit: 'A',
          timeUnit: 'ms',
          samples: buildIllustrativePrimaryCurrent()
        },
        {
          id: 'demo-secondary-voltage',
          label: 'Illustrative secondary trace (demo shape)',
          unit: 'kV',
          timeUnit: 'ms',
          samples: buildIllustrativeChannelVoltage()
        }
      ]
    }
  };

  payload.multimeter.unsupportedExample = {
    id: 'demo-unsupported',
    label: 'Illustrative unsupported mode (demo)',
    mode: 'capacitance',
    value: 1,
    unit: 'F'
  };

  payload.scanTool = {
    vehicle: { demoLabel: 'Illustrative training vehicle (demo)', demoConfiguration: 'four-cylinder, simulated' },
    dtcs: [
      { code: 'DEMO-0001', description: 'Illustrative placeholder code — not a real diagnostic trouble code', status: 'demo-stored', type: 'demo' },
      { code: 'DEMO-0002', description: 'Illustrative placeholder code — not a real diagnostic trouble code', status: 'demo-pending', type: 'demo' }
    ],
    freezeFrame: {
      dtcCode: 'DEMO-0001',
      conditions: [
        { label: 'Illustrative engine speed (demo)', value: 1450, unit: 'rpm' },
        { label: 'Illustrative calculated load (demo)', value: 38, unit: '%' },
        { label: 'Illustrative coolant temperature (demo)', value: 91, unit: 'C' }
      ]
    },
    liveData: [
      { pid: 'DEMO-PID-01', label: 'Illustrative short-term fuel trim (demo)', value: 2.4, unit: '%' },
      { pid: 'DEMO-PID-02', label: 'Illustrative long-term fuel trim (demo)', value: 1.1, unit: '%' },
      { pid: 'DEMO-PID-03', label: 'Illustrative battery voltage (demo)', value: 13.9, unit: 'V' }
    ],
    misfireCounters: [
      { cylinder: 'Cylinder 1 (demo)', count: 0, window: 'demo window' },
      { cylinder: 'Cylinder 2 (demo)', count: 3, window: 'demo window' },
      { cylinder: 'Cylinder 3 (demo)', count: 0, window: 'demo window' },
      { cylinder: 'Cylinder 4 (demo)', count: 0, window: 'demo window' }
    ],
    operatingConditions: [
      { label: 'Illustrative operating state (demo)', value: 'simulated idle' },
      { label: 'Illustrative ambient temperature (demo)', value: 21, unit: 'C' }
    ],
    repairVerification: {
      dtcCleared: false,
      monitorStatus: 'illustrative demo status — not a real monitor result',
      notes: 'Illustrative demo payload. No verification outcome is asserted by the asset.',
      evidenceRef: 'demo-evidence-reference'
    }
  };


  payload.components = [
    {
      id: 'demo-battery', label: 'Illustrative battery (demo)', category: 'battery',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [
        { id: 'positive', label: 'Positive terminal', role: 'power' },
        { id: 'negative', label: 'Negative terminal', role: 'ground' }
      ]
    },
    {
      id: 'demo-ignition-coil', label: 'Illustrative ignition coil (demo)', category: 'ignition-coil',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [
        { id: 'primary-a', label: 'Primary terminal A', role: 'control' },
        { id: 'primary-b', label: 'Primary terminal B', role: 'power' },
        { id: 'secondary', label: 'Secondary terminal', role: 'high-voltage' }
      ]
    },
    {
      id: 'demo-spark-plug', label: 'Illustrative spark plug (demo)', category: 'spark-plug',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [{ id: 'terminal', label: 'Terminal', role: 'high-voltage' }]
    },
    {
      id: 'demo-harness', label: 'Illustrative wiring harness (demo)', category: 'wiring-harness',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [
        { id: 'branch-1', label: 'Branch 1', role: 'signal' },
        { id: 'branch-2', label: 'Branch 2', role: 'power' }
      ]
    },
    {
      id: 'demo-connector', label: 'Illustrative connector (demo)', category: 'connector',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [
        { id: 'pin-1', label: 'Pin 1', role: 'power' },
        { id: 'pin-2', label: 'Pin 2', role: 'ground' },
        { id: 'pin-3', label: 'Pin 3', role: 'signal' }
      ]
    },
    {
      id: 'demo-cylinder-1', label: 'Illustrative cylinder 1 (demo)', category: 'cylinder',
      description: 'Illustrative training geometry supplied by the demo payload.', terminals: []
    },
    {
      id: 'demo-cylinder-2', label: 'Illustrative cylinder 2 (demo)', category: 'cylinder',
      description: 'Illustrative training geometry supplied by the demo payload.', terminals: []
    },
    {
      id: 'demo-cylinder-3', label: 'Illustrative cylinder 3 (demo)', category: 'cylinder',
      description: 'Illustrative training geometry supplied by the demo payload.', terminals: []
    },
    {
      id: 'demo-cylinder-4', label: 'Illustrative cylinder 4 (demo)', category: 'cylinder',
      description: 'Illustrative training geometry supplied by the demo payload.', terminals: []
    },
    {
      id: 'demo-ground', label: 'Illustrative ground connection (demo)', category: 'ground',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [{ id: 'chassis', label: 'Chassis point', role: 'ground' }]
    },
    {
      id: 'demo-circuit-power', label: 'Illustrative power circuit (demo)', category: 'circuit-power',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [{ id: 'feed', label: 'Feed', role: 'power' }, { id: 'return', label: 'Return', role: 'ground' }]
    },
    {
      id: 'demo-circuit-signal', label: 'Illustrative signal circuit (demo)', category: 'circuit-signal',
      description: 'Illustrative training geometry supplied by the demo payload.',
      terminals: [{ id: 'signal', label: 'Signal', role: 'signal' }, { id: 'reference', label: 'Reference', role: 'ground' }]
    },
    {
      id: 'demo-unsupported-category', label: 'Illustrative unsupported category (demo)', category: 'demo-unknown-category',
      description: 'Demonstrates the explicit fallback shape for an unsupported category.',
      terminals: [{ id: 'pin-1', label: 'Pin 1', role: null }]
    }
  ];

  return payload;
});


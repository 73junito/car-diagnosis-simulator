(function (root) {
  'use strict';
  var CORRECT_REPAIR_ID = 'replace-ignition-coil-cylinder-3';
  var TEST_CATALOG = [
    { id: 'scan-tool-dtc', label: 'Scan tool: read DTCs', category: 'scan-tool' },
    { id: 'scan-tool-live-data', label: 'Scan tool: live data', category: 'scan-tool' },
    { id: 'visual-inspection', label: 'Visual inspection', category: 'inspection' },
    { id: 'coil-secondary-resistance', label: 'DMM: coil secondary (Cyl 3)', category: 'multimeter' },
    { id: 'coil-primary-resistance', label: 'DMM: coil primary (Cyl 3)', category: 'multimeter' },
    { id: 'scope-ignition-secondary', label: 'Scope: ignition secondary (Cyl 3)', category: 'oscilloscope' },
    { id: 'compression-test', label: 'Compression test (Cyl 3)', category: 'mechanical' }
  ];
  var REPAIR_CATALOG = [
    { id: 'replace-ignition-coil-cylinder-3', label: 'Replace ignition coil — cyl 3' },
    { id: 'replace-spark-plug-cylinder-3', label: 'Replace spark plug — cyl 3' },
    { id: 'replace-fuel-injector-cylinder-3', label: 'Replace fuel injector — cyl 3' }
  ];
  function measurement(testId, repaired) {
    switch (testId) {
      case 'scan-tool-dtc': return repaired
        ? { dtcs: [], mil: 'off', note: 'SIMULATED: no DTCs after repair.' }
        : { dtcs: [{ code: 'P0303' }, { code: 'P0300' }], mil: 'on', note: 'SIMULATED misfire DTCs.' };
      case 'scan-tool-live-data': return repaired
        ? { rpm: 750, misfireCyl3: 0, note: 'SIMULATED: stable.' }
        : { rpm: 780, misfireCyl3: 47, note: 'SIMULATED: cyl-3 misfire counter high.' };
      case 'coil-secondary-resistance': return repaired
        ? { display: '8.2 kΩ', verdict: 'within-spec' }
        : { display: 'OL (open)', verdict: 'open-circuit' };
      case 'coil-primary-resistance': return { display: '0.8 Ω', verdict: 'within-spec' };
      case 'scope-ignition-secondary': return repaired
        ? { pattern: 'normal-burn-line', note: 'SIMULATED: normal spark.' }
        : { pattern: 'missing-spark-line', note: 'SIMULATED: no spark — secondary open.' };
      case 'compression-test': return { display: '178 psi', verdict: 'within-spec' };
      default: return { display: 'SIMULATED OK', verdict: 'within-spec' };
    }
  }
  function createAut250MockAdapter(opts) {
    var now = (opts && opts.now) || function () { return new Date().toISOString(); };
    var state = { id: 'SIM-' + Math.random().toString(36).slice(2, 7).toUpperCase(), repaired: false, events: [], repairs: [] };
    function ev(kind, payload) {
      var e = { seq: state.events.length + 1, at: now(), kind: kind, payload: payload || {} };
      state.events.push(e); return e;
    }
    var api = {
      ADAPTER_ID: 'aut250-mock', ADAPTER_VERSION: '0.1.0-mock',
      SIMULATED: true, DEVELOPMENTAL: true,
      TEST_CATALOG: TEST_CATALOG.slice(), REPAIR_CATALOG: REPAIR_CATALOG.slice(),
      CORRECT_REPAIR_ID: CORRECT_REPAIR_ID,
      session: function () {
        var s = { adapterId: api.ADAPTER_ID, simulated: true, sessionId: state.id, course: 'AUT-250',
          complaint: 'SIMULATED: rough idle, MIL on.', testCatalog: TEST_CATALOG.slice(), repairCatalog: REPAIR_CATALOG.slice() };
        ev('session', { sessionId: state.id }); return s;
      },
      record: function (t, p) { if (!t) throw new Error('record needs type'); return ev(t, p || {}); },
      test: function (id) {
        var m = measurement(id, state.repaired);
        if (!m && id !== 'visual-inspection') throw new Error('Unknown test: ' + id);
        ev('test', { testId: id, measurement: m });
        return { testId: id, simulated: true, measurement: m };
      },
      repair: function (id) {
        var ok = id === CORRECT_REPAIR_ID;
        if (ok) state.repaired = true;
        state.repairs.push({ repairId: id, at: now(), success: ok });
        var r = { repairId: id, simulated: true, success: ok, verified: ok,
          verification: ok ? 'SIMULATED: misfire 0, DTCs gone.' : 'SIMULATED: fault remains.' };
        ev('repair', r); return r;
      },
      exportEvidence: function () {
        var b = { bundle: 'aut250-sim-evidence', simulated: true, notForAssessment: true,
          sessionId: state.id, exportedAt: now(), repaired: state.repaired,
          repairs: state.repairs.slice(), events: state.events.slice() };
        ev('export', { n: state.events.length }); b.events = state.events.slice(); return b;
      }
    };
    return api;
  }
  var out = { createAut250MockAdapter: createAut250MockAdapter, TEST_CATALOG: TEST_CATALOG, REPAIR_CATALOG: REPAIR_CATALOG };
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
  else root.Aut250MockAdapter = out;
  return out;
})(typeof window !== 'undefined' ? window : globalThis);

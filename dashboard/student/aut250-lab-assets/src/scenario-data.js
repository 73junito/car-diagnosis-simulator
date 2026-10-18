/**
 * AUT-250 Interactive Laboratory Assets — scenario data normalization.
 *
 * Accepts an external provider payload and returns a validated view model.
 * Invalid or absent input yields explicit issues and null values. No
 * reading, specification, code, or conclusion is ever synthesized.
 *
 * UMD: window.Aut250LabAssets.ScenarioData and require().
 */
(function (root, factory) {
  'use strict';
  var dc = (typeof module !== 'undefined' && module.exports)
    ? require('./data-contract')
    : (root && root.Aut250LabAssets && root.Aut250LabAssets.DataContract);
  var api = factory(dc);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Aut250LabAssets = root.Aut250LabAssets || {};
    root.Aut250LabAssets.ScenarioData = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (DC) {
  'use strict';

  var MODES = DC.MEASUREMENT_MODES;
  var isPlainObject = DC.isPlainObject;
  var finiteNumber = DC.finiteNumber;
  var nonEmptyString = DC.nonEmptyString;

  function textOrNull(value) {
    return nonEmptyString(value) ? value : null;
  }

  function normalizeTestPoint(raw) {
    if (!isPlainObject(raw)) return null;
    var componentId = textOrNull(raw.componentId);
    var terminalId = textOrNull(raw.terminalId);
    if (!componentId && !terminalId) return null;
    return { componentId: componentId, terminalId: terminalId };
  }

  /**
   * Validate one multimeter measurement supplied by the provider.
   * @returns {{ok: boolean, issues: string[], measurement: object|null}}
   */
  function normalizeMeasurement(raw) {
    if (!isPlainObject(raw)) {
      return { ok: false, issues: ['Measurement entry must be an object.'], measurement: null };
    }
    var mode = raw.mode;
    if (!nonEmptyString(mode)) {
      return { ok: false, issues: ['Measurement requires a mode.'], measurement: null };
    }
    var spec = MODES[mode];
    if (!spec) {
      return { ok: false, issues: ['Unsupported measurement mode: ' + String(mode) + '.'], measurement: null };
    }

    var measurement = {
      id: textOrNull(raw.id),
      label: textOrNull(raw.label),
      mode: mode,
      value: null,
      unit: null,
      suppliedUnit: null,
      continuity: null,
      resistanceOhm: null,
      quality: textOrNull(raw.quality),
      testPoint: normalizeTestPoint(raw.testPoint)
    };

    if (spec.requiresValue) {
      if (!finiteNumber(raw.value)) {
        return { ok: false, issues: ['Mode ' + mode + ' requires a finite numeric value.'], measurement: null };
      }
      if (!nonEmptyString(raw.unit)) {
        return { ok: false, issues: ['Mode ' + mode + ' requires a supplied unit.'], measurement: null };
      }
      if (DC.unitFamily(raw.unit) !== spec.family) {
        return { ok: false, issues: ['Unit ' + raw.unit + ' is not valid for mode ' + mode + '.'], measurement: null };
      }
      measurement.value = raw.value;
      measurement.unit = raw.unit;
      measurement.suppliedUnit = raw.unit;
      return { ok: true, issues: [], measurement: measurement };
    }

    if (DC.CONTINUITY_STATES.indexOf(raw.continuity) === -1) {
      return { ok: false, issues: ['Continuity mode requires continuity of "open" or "closed".'], measurement: null };
    }
    measurement.continuity = raw.continuity;
    if (finiteNumber(raw.resistanceOhm)) {
      measurement.resistanceOhm = raw.resistanceOhm;
      measurement.value = raw.resistanceOhm;
      measurement.unit = 'ohm';
      measurement.suppliedUnit = 'ohm';
    }
    return { ok: true, issues: [], measurement: measurement };
  }

  /**
   * Validate and time-order waveform samples supplied by the provider.
   */
  function normalizeSamples(raw) {
    if (!Array.isArray(raw)) {
      return { ok: false, issues: ['Channel samples must be an array.'], samples: [] };
    }
    var issues = [];
    var samples = [];
    for (var i = 0; i < raw.length; i += 1) {
      var sample = raw[i];
      if (!isPlainObject(sample) || !finiteNumber(sample.t) || !finiteNumber(sample.v)) {
        issues.push('Sample ' + i + ' ignored: requires finite t and v.');
        continue;
      }
      samples.push({ t: sample.t, v: sample.v });
    }
    samples.sort(function (a, b) { return a.t - b.t; });
    return { ok: samples.length > 0, issues: issues, samples: samples };
  }


  /**
   * Descriptive statistics computed from supplied samples only.
   * These describe the data; they are not diagnostic conclusions.
   */
  function computeStats(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return null;
    var min = Infinity;
    var max = -Infinity;
    var sum = 0;
    for (var i = 0; i < samples.length; i += 1) {
      var v = samples[i].v;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    var first = samples[0];
    var last = samples[samples.length - 1];
    return {
      count: samples.length,
      min: min,
      max: max,
      mean: sum / samples.length,
      peakToPeak: max - min,
      firstT: first.t,
      lastT: last.t,
      span: last.t - first.t
    };
  }

  /**
   * First edge crossing of the supplied level within the supplied samples.
   */
  function findTrigger(samples, level, edge) {
    if (!Array.isArray(samples) || samples.length < 2) {
      return { found: false, index: null, reason: 'A trigger requires at least two samples.' };
    }
    if (!finiteNumber(level)) {
      return { found: false, index: null, reason: 'A trigger requires a finite level.' };
    }
    var direction = edge === 'falling' ? -1 : 1;
    for (var i = 1; i < samples.length; i += 1) {
      var prev = samples[i - 1].v;
      var cur = samples[i].v;
      if (direction > 0 && prev < level && cur >= level) {
        return { found: true, index: i, t: samples[i].t, v: cur, level: level, edge: 'rising' };
      }
      if (direction < 0 && prev > level && cur <= level) {
        return { found: true, index: i, t: samples[i].t, v: cur, level: level, edge: 'falling' };
      }
    }
    var edgeLabel = edge === 'falling' ? 'falling' : 'rising';
    return {
      found: false,
      index: null,
      reason: 'No ' + edgeLabel + ' crossing of ' + level + ' exists in the supplied samples.'
    };
  }

  return {
    normalizeTestPoint: normalizeTestPoint,
    normalizeMeasurement: normalizeMeasurement,
    normalizeSamples: normalizeSamples,
    computeStats: computeStats,
    findTrigger: findTrigger
  };
});

/**
 * AUT-250 Interactive Laboratory Assets — external data contract (v0.1.0).
 *
 * BOUNDARY: these assets never invent automotive diagnostic readings,
 * specifications, trouble codes, or conclusions. Every value displayed by
 * the instruments originates from an external provider payload that is
 * normalized and validated here. Absent data produces an explicit
 * "not supplied" state, never a synthesized number.
 *
 * No database access, no grading, no network calls.
 *
 * UMD: usable as window.Aut250LabAssets.DataContract and via require().
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Aut250LabAssets = root.Aut250LabAssets || {};
    root.Aut250LabAssets.DataContract = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var CONTRACT_VERSION = '0.1.0';

  // Display-only unit families. Conversion is a deterministic rescale of a
  // value the provider already supplied; it never creates new measurements.
  var UNIT_FAMILIES = {
    voltage: { V: 1, mV: 0.001 },
    resistance: { ohm: 1, kohm: 1000, Mohm: 1000000 },
    current: { A: 1, mA: 0.001 },
    time: { s: 1, ms: 0.001, us: 0.000001 }
  };

  var MEASUREMENT_MODES = {
    'dc-voltage': { family: 'voltage', requiresValue: true },
    'ac-voltage': { family: 'voltage', requiresValue: true },
    resistance: { family: 'resistance', requiresValue: true },
    'dc-current': { family: 'current', requiresValue: true },
    continuity: { family: null, requiresValue: false }
  };

  var CONTINUITY_STATES = ['open', 'closed'];

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function nonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function unitFamily(unit) {
    for (var family in UNIT_FAMILIES) {
      if (Object.prototype.hasOwnProperty.call(UNIT_FAMILIES[family], unit)) return family;
    }
    return null;
  }

  /**
   * Rescale a provider-supplied value between units of the same family.
   * Returns { ok: false, reason } for unknown or incompatible units.
   */
  function convert(value, fromUnit, toUnit) {
    if (!finiteNumber(value)) return { ok: false, reason: 'A numeric value is required to convert units.' };
    var fromFamily = unitFamily(fromUnit);
    var toFamily = unitFamily(toUnit);
    if (!fromFamily || !toFamily) return { ok: false, reason: 'Unknown unit: ' + String(fromUnit) + ' or ' + String(toUnit) + '.' };
    if (fromFamily !== toFamily) return { ok: false, reason: 'Cannot convert ' + fromUnit + ' to ' + toUnit + '.' };
    if (fromUnit === toUnit) return { ok: true, value: value, unit: toUnit };
    var base = value * UNIT_FAMILIES[fromFamily][fromUnit];
    return { ok: true, value: base / UNIT_FAMILIES[toFamily][toUnit], unit: toUnit };
  }

  function listUnitsForMode(mode) {
    var spec = MEASUREMENT_MODES[mode];
    if (!spec || !spec.family) return [];
    var units = UNIT_FAMILIES[spec.family];
    return Object.keys(units).filter(function (unit) { return Object.prototype.hasOwnProperty.call(units, unit); });
  }

  return {
    CONTRACT_VERSION: CONTRACT_VERSION,
    UNIT_FAMILIES: UNIT_FAMILIES,
    MEASUREMENT_MODES: MEASUREMENT_MODES,
    CONTINUITY_STATES: CONTINUITY_STATES,
    isPlainObject: isPlainObject,
    finiteNumber: finiteNumber,
    nonEmptyString: nonEmptyString,
    asArray: asArray,
    unitFamily: unitFamily,
    convert: convert,
    listUnitsForMode: listUnitsForMode
  };
});

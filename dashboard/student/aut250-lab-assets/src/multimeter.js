/**
 * AUT-250 Interactive Laboratory Assets — virtual multimeter.
 *
 * Displays ONLY measurements supplied through setMeasurement(). The
 * instrument never generates, estimates, or infers a reading. Display-unit
 * selection rescales a supplied value within its own unit family; if that is
 * impossible the instrument says so instead of showing a substitute number.
 *
 * UMD: window.Aut250LabAssets.Multimeter and require().
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var dc = isNode ? require('./data-contract') : (root && root.Aut250LabAssets && root.Aut250LabAssets.DataContract);
  var sd = isNode ? require('./scenario-data') : (root && root.Aut250LabAssets && root.Aut250LabAssets.ScenarioData);
  var api = factory(dc, sd);
  if (isNode) module.exports = api;
  if (root) {
    root.Aut250LabAssets = root.Aut250LabAssets || {};
    root.Aut250LabAssets.Multimeter = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (DC, SD) {
  'use strict';

  var instanceSeq = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    var rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  }

  function describeTestPoint(testPoint) {
    if (!testPoint) return null;
    var parts = [];
    if (testPoint.componentId) parts.push(testPoint.componentId);
    if (testPoint.terminalId) parts.push(testPoint.terminalId);
    return parts.length ? parts.join(' · ') : null;
  }

  /**
   * @param {{mount: Element}} options
   */
  function createMultimeter(options) {
    var opts = options || {};
    var mount = opts.mount;
    if (!mount) throw new Error('Multimeter requires a mount element.');
    instanceSeq += 1;
    var uid = 'dmm-' + instanceSeq;

    var state = { measurement: null, issues: [], displayUnit: null };

    var rootEl = el('section', 'tm-dmm');
    rootEl.setAttribute('aria-labelledby', uid + '-title');

    var header = el('header', 'tm-asset__header');
    var title = el('h3', 'tm-asset__title', 'Digital multimeter');
    title.id = uid + '-title';
    header.append(title, el('p', 'tm-asset__badge', 'SIMULATED DISPLAY · readings are supplied by an external data provider'));

    var body = el('div', 'tm-dmm__body');
    var screen = el('div', 'tm-dmm__screen');
    screen.setAttribute('role', 'group');
    screen.setAttribute('aria-label', 'Measurement display');

    var modeEl = el('p', 'tm-dmm__mode', 'Mode: not selected');
    var valueEl = el('p', 'tm-dmm__value', 'No measurement supplied');
    valueEl.setAttribute('role', 'status');
    valueEl.setAttribute('aria-live', 'polite');
    var metaEl = el('p', 'tm-dmm__meta', '');
    var continuityEl = el('p', 'tm-dmm__continuity', 'Continuity: not supplied');
    continuityEl.setAttribute('role', 'status');
    continuityEl.setAttribute('aria-live', 'polite');
    screen.append(modeEl, valueEl, metaEl, continuityEl);

    var controls = el('div', 'tm-dmm__controls');
    var unitLabel = el('label', 'tm-asset__label', 'Display unit');
    unitLabel.setAttribute('for', uid + '-unit');
    var unitSelect = el('select', 'tm-asset__select');
    unitSelect.id = uid + '-unit';
    unitSelect.disabled = true;
    unitSelect.append(new Option('No unit available', ''));

    var leads = el('div', 'tm-dmm__leads');
    leads.setAttribute('role', 'group');
    leads.setAttribute('aria-label', 'Test leads');
    var positiveLead = el('div', 'tm-lead tm-lead--positive');
    positiveLead.append(el('span', 'tm-lead__jack', 'VΩ'), el('span', 'tm-lead__probe'), el('span', 'tm-lead__label', 'Positive (+) lead — not connected'));
    var negativeLead = el('div', 'tm-lead tm-lead--negative');
    negativeLead.append(el('span', 'tm-lead__jack', 'COM'), el('span', 'tm-lead__probe'), el('span', 'tm-lead__label', 'Negative (−) lead — not connected'));

    var issuesEl = el('p', 'tm-asset__issues', '');
    issuesEl.setAttribute('role', 'status');
    issuesEl.setAttribute('aria-live', 'polite');

    leads.append(positiveLead, negativeLead);
    controls.append(unitLabel, unitSelect, leads, issuesEl);
    body.append(screen, controls);
    rootEl.append(header, body);
    mount.append(rootEl);


    function setLeadState(active) {
      positiveLead.classList.toggle('tm-lead--active', active);
      negativeLead.classList.toggle('tm-lead--active', active);
      positiveLead.querySelector('.tm-lead__label').textContent = active
        ? 'Positive (+) lead — connected to supplied test point'
        : 'Positive (+) lead — not connected';
      negativeLead.querySelector('.tm-lead__label').textContent = active
        ? 'Negative (−) lead — connected to supplied test point'
        : 'Negative (−) lead — not connected';
    }

    function populateUnits(measurement) {
      unitSelect.replaceChildren();
      // Continuity is a supplied state, not a rescalable value, so unit
      // selection stays unavailable even when a resistance is also supplied.
      if (!measurement || !measurement.unit || measurement.mode === 'continuity') {
        unitSelect.disabled = true;
        unitSelect.append(new Option('No unit available', ''));
        return;
      }
      var family = DC.listUnitsForMode(measurement.mode);
      var units = family.length ? family : [measurement.unit];
      units.forEach(function (unit) {
        var suffix = unit === measurement.suppliedUnit ? ' (supplied)' : '';
        unitSelect.append(new Option(unit + suffix, unit));
      });
      unitSelect.disabled = false;
      unitSelect.value = state.displayUnit || measurement.suppliedUnit;
    }

    function render() {
      var measurement = state.measurement;
      issuesEl.textContent = state.issues.length ? state.issues.join(' ') : '';

      if (!measurement) {
        modeEl.textContent = 'Mode: not selected';
        valueEl.textContent = 'No measurement supplied';
        metaEl.textContent = 'Waiting for external measurement data.';
        continuityEl.textContent = 'Continuity: not supplied';
        setLeadState(false);
        populateUnits(null);
        return;
      }

      modeEl.textContent = 'Mode: ' + measurement.mode + (measurement.label ? ' · ' + measurement.label : '');
      setLeadState(true);
      populateUnits(measurement);

      if (measurement.mode === 'continuity') {
        valueEl.textContent = measurement.continuity === 'closed' ? 'CLOSED' : 'OPEN';
        continuityEl.textContent = 'Continuity: ' + measurement.continuity + ' (supplied)';
        metaEl.textContent = measurement.resistanceOhm === null
          ? 'Supplied resistance: not supplied.'
          : 'Supplied resistance: ' + formatNumber(measurement.resistanceOhm) + ' ohm.';
        return;
      }

      continuityEl.textContent = 'Continuity: not supplied for this measurement.';
      var target = state.displayUnit || measurement.suppliedUnit;
      if (target === measurement.suppliedUnit) {
        valueEl.textContent = formatNumber(measurement.value) + ' ' + measurement.unit;
      } else {
        var converted = DC.convert(measurement.value, measurement.unit, target);
        valueEl.textContent = converted.ok
          ? formatNumber(converted.value) + ' ' + converted.unit
          : 'Not available in ' + target;
      }

      var details = ['Supplied as ' + formatNumber(measurement.value) + ' ' + measurement.suppliedUnit];
      var testPoint = describeTestPoint(measurement.testPoint);
      if (testPoint) details.push('Test point: ' + testPoint);
      if (measurement.quality) details.push('Provider quality flag: ' + measurement.quality);
      metaEl.textContent = details.join(' · ') + '.';
    }

    var api = {
      ASSET_ID: 'aut250-lab-asset-multimeter',
      mount: rootEl,
      setMeasurement: function (raw) {
        if (raw === null || raw === undefined) {
          state.measurement = null;
          state.issues = [];
          state.displayUnit = null;
          render();
          return { ok: true, issues: [], measurement: null };
        }
        var result = SD.normalizeMeasurement(raw);
        if (!result.ok) {
          state.measurement = null;
          state.issues = result.issues;
          state.displayUnit = null;
          render();
          return result;
        }
        state.measurement = result.measurement;
        state.issues = [];
        state.displayUnit = result.measurement.suppliedUnit;
        render();
        return result;
      },
      setDisplayUnit: function (unit) {
        if (!state.measurement) return { ok: false, reason: 'No measurement supplied.' };
        if (unit === state.measurement.suppliedUnit) {
          state.displayUnit = unit;
          render();
          return { ok: true };
        }
        var probe = DC.convert(state.measurement.value, state.measurement.unit, unit);
        if (!probe.ok) return { ok: false, reason: probe.reason };
        state.displayUnit = unit;
        render();
        return { ok: true };
      },
      getState: function () {
        return { measurement: state.measurement, issues: state.issues.slice(), displayUnit: state.displayUnit };
      },
      destroy: function () { rootEl.remove(); }
    };

    unitSelect.addEventListener('change', function () {
      api.setDisplayUnit(unitSelect.value);
    });

    render();
    return api;
  }

  return { createMultimeter: createMultimeter };
});


/**
 * AUT-250 Interactive Laboratory Assets — OBD-II scan tool panel.
 *
 * Every trouble code, freeze-frame field, live-data value, misfire counter,
 * operating condition, and repair-verification result shown here is supplied
 * by an external data provider. The panel does not invent, translate, or
 * interpret diagnostic content, and it never states a pass/fail verdict.
 *
 * UMD: window.Aut250LabAssets.ScanTool and require().
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var dc = isNode ? require('./data-contract') : (root && root.Aut250LabAssets && root.Aut250LabAssets.DataContract);
  var api = factory(dc);
  if (isNode) module.exports = api;
  if (root) {
    root.Aut250LabAssets = root.Aut250LabAssets || {};
    root.Aut250LabAssets.ScanTool = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (DC) {
  'use strict';

  var instanceSeq = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function textOrNull(value) {
    return DC.nonEmptyString(value) ? value : null;
  }

  function valueOrNull(value) {
    if (DC.finiteNumber(value)) return value;
    return textOrNull(value);
  }

  function displayValue(value) {
    if (value === null || value === undefined) return 'not supplied';
    return typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : String(value);
  }

  function normalizeDtcs(raw) {
    var issues = [];
    var items = [];
    DC.asArray(raw).forEach(function (entry, index) {
      if (!DC.isPlainObject(entry) || !DC.nonEmptyString(entry.code)) {
        issues.push('Trouble-code entry ' + index + ' ignored: a code string is required.');
        return;
      }
      items.push({
        code: entry.code,
        description: textOrNull(entry.description),
        status: textOrNull(entry.status),
        type: textOrNull(entry.type)
      });
    });
    return { issues: issues, items: items };
  }

  function normalizeFieldList(raw, label, requirePid) {
    var issues = [];
    var items = [];
    DC.asArray(raw).forEach(function (entry, index) {
      if (!DC.isPlainObject(entry) || !DC.nonEmptyString(entry.label)) {
        issues.push(label + ' entry ' + index + ' ignored: a label is required.');
        return;
      }
      var value = valueOrNull(entry.value);
      if (value === null) {
        issues.push(label + ' entry ' + index + ' ignored: a value is required.');
        return;
      }
      var item = { label: entry.label, value: value, unit: textOrNull(entry.unit) };
      if (requirePid) item.pid = textOrNull(entry.pid);
      items.push(item);
    });
    return { issues: issues, items: items };
  }

  function normalizeFreezeFrame(raw) {
    if (raw === null || raw === undefined) return { issues: [], frame: null };
    if (!DC.isPlainObject(raw)) return { issues: ['Freeze-frame data must be an object.'], frame: null };
    var conditions = normalizeFieldList(raw.conditions, 'Freeze-frame condition', false);
    return {
      issues: conditions.issues,
      frame: { dtcCode: textOrNull(raw.dtcCode), conditions: conditions.items }
    };
  }

  function normalizeMisfireCounters(raw) {
    var issues = [];
    var items = [];
    DC.asArray(raw).forEach(function (entry, index) {
      if (!DC.isPlainObject(entry) || !DC.nonEmptyString(entry.cylinder)) {
        issues.push('Misfire counter ' + index + ' ignored: a cylinder label is required.');
        return;
      }
      if (!DC.finiteNumber(entry.count)) {
        issues.push('Misfire counter ' + index + ' ignored: a finite count is required.');
        return;
      }
      items.push({ cylinder: entry.cylinder, count: entry.count, window: textOrNull(entry.window) });
    });
    return { issues: issues, items: items };
  }

  /**
   * Repair verification is only shown when the provider explicitly supplies it.
   * An absent block is reported as "not supplied" rather than assumed successful.
   */
  function normalizeRepairVerification(raw) {
    if (raw === null || raw === undefined) {
      return { issues: [], verification: null, supplied: false };
    }
    if (!DC.isPlainObject(raw)) {
      return { issues: ['Repair verification must be an object.'], verification: null, supplied: false };
    }
    var issues = [];
    var dtcCleared = null;
    if (raw.dtcCleared !== undefined && raw.dtcCleared !== null) {
      if (typeof raw.dtcCleared !== 'boolean') {
        issues.push('Repair verification dtcCleared must be true or false when supplied.');
      } else {
        dtcCleared = raw.dtcCleared;
      }
    }
    return {
      issues: issues,
      supplied: true,
      verification: {
        dtcCleared: dtcCleared,
        monitorStatus: textOrNull(raw.monitorStatus),
        notes: textOrNull(raw.notes),
        evidenceRef: textOrNull(raw.evidenceRef)
      }
    };
  }

  function normalizeScanToolPayload(raw) {
    var payload = DC.isPlainObject(raw) ? raw : {};
    var dtcs = normalizeDtcs(payload.dtcs);
    var freezeFrame = normalizeFreezeFrame(payload.freezeFrame);
    var liveData = normalizeFieldList(payload.liveData, 'Live-data', true);
    var misfire = normalizeMisfireCounters(payload.misfireCounters);
    var conditions = normalizeFieldList(payload.operatingConditions, 'Operating condition', false);
    var verification = normalizeRepairVerification(payload.repairVerification);
    return {
      vehicle: DC.isPlainObject(payload.vehicle) ? payload.vehicle : null,
      dtcs: dtcs.items,
      freezeFrame: freezeFrame.frame,
      liveData: liveData.items,
      misfireCounters: misfire.items,
      operatingConditions: conditions.items,
      repairVerification: verification.verification,
      repairVerificationSupplied: verification.supplied,
      issues: []
        .concat(dtcs.issues, freezeFrame.issues, liveData.issues, misfire.issues, conditions.issues, verification.issues)
    };
  }


  /**
   * @param {{mount: Element}} options
   */
  function createScanTool(options) {
    var opts = options || {};
    var mount = opts.mount;
    if (!mount) throw new Error('Scan tool requires a mount element.');
    instanceSeq += 1;
    var uid = 'scan-' + instanceSeq;

    var state = { data: normalizeScanToolPayload(null) };

    var rootEl = el('section', 'tm-scan');
    rootEl.setAttribute('aria-labelledby', uid + '-title');

    var header = el('header', 'tm-asset__header');
    var title = el('h3', 'tm-asset__title', 'OBD-II scan tool');
    title.id = uid + '-title';
    header.append(title, el('p', 'tm-asset__badge', 'SIMULATED PANEL · all data is supplied by an external provider'));

    var vehicleEl = el('p', 'tm-scan__vehicle', 'Vehicle information: not supplied');

    var grid = el('div', 'tm-scan__grid');
    var panels = [
      { key: 'dtcs', heading: 'Diagnostic trouble codes' },
      { key: 'freezeFrame', heading: 'Freeze-frame information' },
      { key: 'liveData', heading: 'Live data' },
      { key: 'misfireCounters', heading: 'Misfire counters' },
      { key: 'operatingConditions', heading: 'Vehicle operating conditions' },
      { key: 'repairVerification', heading: 'Repair-verification results (supplied)' }
    ];
    var hosts = {};
    panels.forEach(function (panel, index) {
      var section = el('section', 'tm-scan__panel');
      var headingId = uid + '-panel-' + index;
      section.setAttribute('aria-labelledby', headingId);
      var heading = el('h4', null, panel.heading);
      heading.id = headingId;
      var host = el('div', 'tm-scan__panel-body');
      hosts[panel.key] = host;
      section.append(heading, host);
      grid.append(section);
    });

    var issuesEl = el('p', 'tm-asset__issues', '');
    issuesEl.setAttribute('role', 'status');
    issuesEl.setAttribute('aria-live', 'polite');

    rootEl.append(header, vehicleEl, grid, issuesEl);
    mount.append(rootEl);

    function renderTable(host, columns, rows, emptyMessage) {
      if (rows.length === 0) {
        host.replaceChildren(el('p', 'tm-asset__hint', emptyMessage));
        return;
      }
      var table = el('table', 'tm-scan__table');
      var head = el('tr');
      columns.forEach(function (column) { head.append(el('th', null, column.label)); });
      table.append(head);
      rows.forEach(function (row) {
        var tr = el('tr');
        columns.forEach(function (column) { tr.append(el('td', null, column.cell(row))); });
        table.append(tr);
      });
      host.replaceChildren(table);
    }


    function renderVehicle() {
      var vehicle = state.data.vehicle;
      if (!vehicle) {
        vehicleEl.textContent = 'Vehicle information: not supplied';
        return;
      }
      var keys = Object.keys(vehicle).filter(function (key) { return DC.nonEmptyString(String(vehicle[key])); });
      if (keys.length === 0) {
        vehicleEl.textContent = 'Vehicle information: not supplied';
        return;
      }
      vehicleEl.textContent = 'Vehicle information (supplied): ' + keys.map(function (key) {
        return key + ' ' + String(vehicle[key]);
      }).join(' · ');
    }

    function render() {
      var data = state.data;
      renderVehicle();

      renderTable(hosts.dtcs, [
        { label: 'Code', cell: function (row) { return row.code; } },
        { label: 'Description (supplied)', cell: function (row) { return displayValue(row.description); } },
        { label: 'Status (supplied)', cell: function (row) { return displayValue(row.status); } },
        { label: 'Type (supplied)', cell: function (row) { return displayValue(row.type); } }
      ], data.dtcs, 'No trouble codes supplied by the provider.');

      var freezeRows = data.freezeFrame ? data.freezeFrame.conditions : [];
      renderTable(hosts.freezeFrame, [
        { label: 'Condition', cell: function (row) { return row.label; } },
        { label: 'Value (supplied)', cell: function (row) { return displayValue(row.value) + (row.unit ? ' ' + row.unit : ''); } }
      ], freezeRows, 'No freeze-frame data supplied by the provider.');

      renderTable(hosts.liveData, [
        { label: 'PID', cell: function (row) { return displayValue(row.pid); } },
        { label: 'Parameter', cell: function (row) { return row.label; } },
        { label: 'Value (supplied)', cell: function (row) { return displayValue(row.value) + (row.unit ? ' ' + row.unit : ''); } }
      ], data.liveData, 'No live-data parameters supplied by the provider.');

      renderTable(hosts.misfireCounters, [
        { label: 'Cylinder', cell: function (row) { return row.cylinder; } },
        { label: 'Count (supplied)', cell: function (row) { return displayValue(row.count); } },
        { label: 'Window (supplied)', cell: function (row) { return displayValue(row.window); } }
      ], data.misfireCounters, 'No misfire counters supplied by the provider.');

      renderTable(hosts.operatingConditions, [
        { label: 'Condition', cell: function (row) { return row.label; } },
        { label: 'Value (supplied)', cell: function (row) { return displayValue(row.value) + (row.unit ? ' ' + row.unit : ''); } }
      ], data.operatingConditions, 'No operating conditions supplied by the provider.');

      if (!data.repairVerificationSupplied) {
        hosts.repairVerification.replaceChildren(el('p', 'tm-asset__hint',
          'Repair verification: not supplied. No verification outcome is assumed.'));
      } else {
        var verification = data.repairVerification;
        var rows = [];
        if (verification.dtcCleared !== null) {
          rows.push({ label: 'DTCs cleared (supplied)', value: verification.dtcCleared ? 'yes' : 'no' });
        }
        if (verification.monitorStatus) rows.push({ label: 'Monitor status (supplied)', value: verification.monitorStatus });
        if (verification.notes) rows.push({ label: 'Notes (supplied)', value: verification.notes });
        if (verification.evidenceRef) rows.push({ label: 'Evidence reference (supplied)', value: verification.evidenceRef });
        renderTable(hosts.repairVerification, [
          { label: 'Field', cell: function (row) { return row.label; } },
          { label: 'Value', cell: function (row) { return row.value; } }
        ], rows, 'Repair verification was supplied without reportable fields.');
      }

      issuesEl.textContent = data.issues.length ? data.issues.join(' ') : '';
    }


    var api = {
      ASSET_ID: 'aut250-lab-asset-scan-tool',
      mount: rootEl,
      setData: function (raw) {
        state.data = normalizeScanToolPayload(raw);
        render();
        return {
          ok: true,
          issues: state.data.issues.slice(),
          counts: {
            dtcs: state.data.dtcs.length,
            liveData: state.data.liveData.length,
            misfireCounters: state.data.misfireCounters.length,
            operatingConditions: state.data.operatingConditions.length,
            repairVerificationSupplied: state.data.repairVerificationSupplied
          }
        };
      },
      clear: function () {
        state.data = normalizeScanToolPayload(null);
        render();
        return { ok: true };
      },
      getState: function () {
        return {
          dtcs: state.data.dtcs.slice(),
          freezeFrame: state.data.freezeFrame,
          liveData: state.data.liveData.slice(),
          misfireCounters: state.data.misfireCounters.slice(),
          operatingConditions: state.data.operatingConditions.slice(),
          repairVerification: state.data.repairVerification,
          repairVerificationSupplied: state.data.repairVerificationSupplied,
          issues: state.data.issues.slice()
        };
      },
      destroy: function () { rootEl.remove(); }
    };

    render();
    return api;
  }

  return {
    createScanTool: createScanTool,
    normalizeScanToolPayload: normalizeScanToolPayload
  };
});


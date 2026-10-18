/**
 * AUT 250 weekly laboratory — shared student runtime (SIMULATED / DEVELOPMENTAL).
 *
 * Renders a student lab from a validated lab.json and wires the approved
 * reusable assets. It performs no grading, produces no score, persists
 * nothing, and never invents a reading: instruments receive only the values
 * the lab package supplies.
 *
 * Qualitative waveform descriptors are rendered as text. No sampled trace is
 * synthesized from a qualitative description.
 *
 * UMD: window.Aut250WeeklyLabRuntime and require().
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Aut250WeeklyLabRuntime = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var AVAILABILITY_LABELS = {
    available: 'Available — reusable approved asset',
    prototype: 'Developmental stand-in — limited, not a completed tool',
    missing: 'Not available — no interaction is provided for this item'
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function section(id, heading, parent) {
    var node = el('section', 'wl-section');
    var head = el('h2', null, heading);
    head.id = id + '-heading';
    node.setAttribute('aria-labelledby', id + '-heading');
    node.append(head);
    if (parent) parent.append(node);
    return node;
  }

  function definitionList(pairs) {
    var list = el('dl', 'wl-facts');
    pairs.forEach(function (pair) {
      list.append(el('dt', null, pair[0]), el('dd', null, pair[1] === null || pair[1] === undefined ? 'not supplied' : String(pair[1])));
    });
    return list;
  }

  function table(columns, rows, emptyMessage) {
    if (!rows.length) return el('p', 'wl-hint', emptyMessage);
    var node = el('table', 'wl-table');
    var head = el('tr');
    columns.forEach(function (column) { head.append(el('th', null, column.label)); });
    node.append(head);
    rows.forEach(function (row) {
      var tr = el('tr');
      columns.forEach(function (column) { tr.append(el('td', null, column.cell(row))); });
      node.append(tr);
    });
    return node;
  }

  function displayValue(value) {
    if (value === null || value === undefined) return 'not supplied';
    return typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : String(value);
  }

  /**
   * @param {{mount: Element, lab: object, assets?: object, onExport?: Function}} options
   */
  function createWeeklyLab(options) {
    var opts = options || {};
    var mount = opts.mount;
    var lab = opts.lab;
    var assets = opts.assets || {};
    if (!mount) throw new Error('Weekly lab runtime requires a mount element.');
    if (!lab || !lab.labId) throw new Error('Weekly lab runtime requires a lab package.');

    var uid = lab.labId;
    var state = { selectedTest: null, justification: '', hypothesisChoice: '', notes: {} };
    var rootEl = el('div', 'wl-lab');
    rootEl.setAttribute('data-lab-id', lab.labId);
    mount.append(rootEl);

    var statusEl = el('p', 'wl-status');
    statusEl.id = uid + '-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    function say(message) { statusEl.textContent = message; }

    // ---- header -------------------------------------------------------------
    var header = el('header', 'wl-header');
    header.append(
      el('p', 'wl-eyebrow', 'AUT 250 · Week ' + lab.week + ' · Simulated developmental lab'),
      el('h1', 'wl-title', lab.title),
      el('p', 'wl-badge', 'SIMULATED, DEVELOPMENTAL, FORMATIVE ONLY — no grade, no score, no assessment eligibility'),
      el('p', 'wl-hint', 'Competency: ' + lab.competencyId + ' · Duration: ' + lab.durationMinutes + ' minutes · Delivery: ' + lab.delivery)
    );
    var objective = el('p', 'wl-objective');
    objective.append(el('strong', null, 'Learning objective: '), document.createTextNode(lab.learningObjective));
    header.append(objective);
    rootEl.append(header);

    // ---- session plan -------------------------------------------------------
    var planSection = section(uid + '-plan', 'Session plan (proposed, not awarded contact hours)', rootEl);
    var planRows = Object.keys(lab.sessionMinutes).map(function (key) {
      return { phase: key.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }), minutes: lab.sessionMinutes[key] };
    });
    var total = planRows.reduce(function (sum, row) { return sum + row.minutes; }, 0);
    planSection.append(table(
      [{ label: 'Phase', cell: function (r) { return r.phase; } },
       { label: 'Minutes', cell: function (r) { return String(r.minutes); } }],
      planRows,
      'No session plan supplied.'
    ));
    planSection.append(el('p', 'wl-hint', 'Total ' + total + ' minutes. Time allocation is a pedagogical estimate, not an institutionally awarded contact hour.'));

    // ---- safety -------------------------------------------------------------
    var safetySection = section(uid + '-safety', 'Safety brief and boundaries', rootEl);
    var safetyList = el('ul', 'wl-list');
    (lab.safetyBriefing.points || []).forEach(function (point) { safetyList.append(el('li', null, point)); });
    safetySection.append(safetyList, el('p', 'wl-boundary', lab.safetyBriefing.boundaries));

    // ---- demonstration ------------------------------------------------------
    var demoSection = section(uid + '-demo', 'Instructor demonstration outline', rootEl);
    demoSection.append(el('p', null, lab.instructorDemonstration.summary));
    var demoList = el('ol', 'wl-list');
    (lab.instructorDemonstration.steps || []).forEach(function (step) { demoList.append(el('li', null, step)); });
    demoSection.append(demoList);

    // ---- equipment ----------------------------------------------------------
    var equipmentSection = section(uid + '-equipment', 'Equipment and asset status', rootEl);
    equipmentSection.append(el('p', 'wl-hint',
      'Every blueprint equipment item is mapped to a real reuse, a disclosed developmental stand-in, or an explicit gap. Placeholder UI is never described as a completed tool.'));
    equipmentSection.append(table(
      [
        { label: 'Item', cell: function (r) { return r.label; } },
        { label: 'Status', cell: function (r) { return AVAILABILITY_LABELS[r.availability] || r.availability; } },
        { label: 'Asset reference', cell: function (r) { return r.assetRef || 'none — no interaction provided'; } },
        { label: 'Disclosure', cell: function (r) { return r.notes || 'not supplied'; } }
      ],
      lab.equipment || [],
      'No equipment supplied.'
    ));

    // ---- scenario -----------------------------------------------------------
    var scenarioSection = section(uid + '-scenario', 'Scenario', rootEl);
    var vehicle = lab.scenario.vehicleContext || {};
    scenarioSection.append(
      el('p', 'wl-symptom', lab.scenario.symptom),
      el('p', null, lab.scenario.systemContext),
      definitionList([
        ['Vehicle context status', vehicle.contextStatus],
        ['Make', vehicle.make],
        ['Year', vehicle.year],
        ['Engine', vehicle.engine],
        ['Retrieval / test mode', vehicle.testMode]
      ])
    );
    if (vehicle.contextStatus !== 'specified') {
      scenarioSection.append(el('p', 'wl-hint',
        'Vehicle-specific context is not specified for this lab. No manufacturer-specific code meaning or specification is asserted.'));
    }

    // ---- supplied measurements ---------------------------------------------
    var measurementSection = section(uid + '-measurements', 'Supplied measurements', rootEl);
    var measurements = (lab.scenario.measurements || []);
    measurementSection.append(table(
      [
        { label: 'Reading', cell: function (r) { return r.label; } },
        { label: 'Value', cell: function (r) { return displayValue(r.value) + (r.unit ? ' ' + r.unit : ''); } },
        { label: 'Conditions', cell: function (r) { return r.conditions; } },
        { label: 'Provenance', cell: function (r) { return r.provenance; } },
        { label: 'Limitations', cell: function (r) { return r.limitations || 'not supplied'; } }
      ],
      measurements,
      'No measurements supplied. The instruments will show their explicit empty states.'
    ));


    // ---- instruments --------------------------------------------------------
    var instrumentSection = section(uid + '-instruments', 'Instrument work area', rootEl);
    var instrumentHost = el('div', 'wl-instruments');
    instrumentSection.append(instrumentHost);
    var mountedInstruments = [];

    var availableIds = (lab.equipment || [])
      .filter(function (item) { return item.availability === 'available'; })
      .map(function (item) { return item.id; });

    function mountInstrument(id) {
      var host = el('div', 'wl-instrument');
      instrumentHost.append(host);
      try {
        if (id === 'dvom' && assets.Multimeter) {
          var dmm = assets.Multimeter.createMultimeter({ mount: host });
          if (measurements.length) dmm.setMeasurement(measurements[0]);
          mountedInstruments.push(dmm);
          return;
        }
        if (id === 'oscilloscope' && assets.Oscilloscope) {
          var scope = assets.Oscilloscope.createOscilloscope({ mount: host });
          var waveform = lab.scenario.waveformEvidence;
          if (waveform && waveform.mode === 'illustrative_samples' && Array.isArray(waveform.samples) && waveform.samples.length) {
            scope.setChannels([{ id: uid + '-channel', label: lab.title + ' (illustrative samples)', unit: waveform.unit || null, timeUnit: waveform.timeUnit || null, samples: waveform.samples }]);
          }
          mountedInstruments.push(scope);
          return;
        }
        if (id === 'scan_tool' && assets.ScanTool) {
          var scan = assets.ScanTool.createScanTool({ mount: host });
          if (lab.scenario.scanData) scan.setData(lab.scenario.scanData);
          mountedInstruments.push(scan);
          return;
        }
      } catch (error) {
        host.append(el('p', 'wl-hint', 'This instrument could not be mounted: ' + String(error.message)));
        return;
      }
      host.append(el('p', 'wl-hint', 'No approved asset is wired for "' + id + '" in this lab.'));
    }

    availableIds.forEach(mountInstrument);

    if (!availableIds.length) {
      instrumentSection.append(el('p', 'wl-hint',
        'No approved reusable instrument is available for this lab. The exercise is completed from the supplied evidence and written reasoning.'));
    }

    // Qualitative waveform evidence is text only: no trace is synthesized.
    var waveform = lab.scenario.waveformEvidence;
    if (waveform) {
      var waveformBlock = el('div', 'wl-waveform');
      waveformBlock.append(el('h3', null, 'Waveform evidence'));
      if (waveform.mode === 'qualitative') {
        waveformBlock.append(el('p', 'wl-hint',
          'Qualitative descriptors only. No sampled trace is supplied or plotted, and no numeric waveform is implied.'));
        var descriptors = el('ul', 'wl-list');
        (waveform.descriptors || []).forEach(function (descriptor) { descriptors.append(el('li', null, descriptor)); });
        waveformBlock.append(descriptors);
      } else {
        waveformBlock.append(el('p', 'wl-hint',
          'Illustrative samples supplied for practice. They are not measurements of any vehicle and are not manufacturer-verified.'));
      }
      if (waveform.notes) waveformBlock.append(el('p', 'wl-hint', waveform.notes));
      instrumentSection.append(waveformBlock);
    }

    // ---- competing hypotheses ----------------------------------------------
    var hypothesisSection = section(uid + '-hypotheses', 'Competing hypotheses to evaluate', rootEl);
    hypothesisSection.append(el('p', 'wl-hint',
      'Both hypotheses are plausible from the supplied evidence. Your task is to state which is better supported and why. No single answer is scored.'));
    (lab.competingHypotheses || []).forEach(function (hypothesis) {
      var card = el('article', 'wl-card');
      card.append(el('h3', null, hypothesis.id + ' — ' + hypothesis.statement));
      if ((hypothesis.evidenceFor || []).length) {
        var forList = el('ul', 'wl-list');
        hypothesis.evidenceFor.forEach(function (item) { forList.append(el('li', null, 'Supports: ' + item)); });
        card.append(forList);
      }
      if ((hypothesis.evidenceAgainst || []).length) {
        var againstList = el('ul', 'wl-list');
        hypothesis.evidenceAgainst.forEach(function (item) { againstList.append(el('li', null, 'Counters: ' + item)); });
        card.append(againstList);
      }
      hypothesisSection.append(card);
    });

    var choiceLabel = el('label', 'wl-label', 'Which hypothesis is better supported by the supplied evidence?');
    choiceLabel.setAttribute('for', uid + '-choice');
    var choice = el('select', 'wl-select');
    choice.id = uid + '-choice';
    choice.append(new Option('Not selected', ''));
    (lab.competingHypotheses || []).forEach(function (hypothesis) {
      choice.append(new Option(hypothesis.id, hypothesis.id));
    });
    choice.addEventListener('change', function () {
      state.hypothesisChoice = choice.value;
      say(choice.value ? 'Hypothesis ' + choice.value + ' recorded locally for your worksheet.' : 'Hypothesis selection cleared.');
    });
    hypothesisSection.append(choiceLabel, choice);


    // ---- test selection -----------------------------------------------------
    var testSection = section(uid + '-tests', 'Test selection and justification', rootEl);
    testSection.append(el('p', 'wl-hint',
      'Choose the next test you would perform and justify it. Selecting a test does not reveal an expected outcome and is not graded.'));
    var testGroup = el('div', 'wl-tests');
    testGroup.setAttribute('role', 'group');
    testGroup.setAttribute('aria-label', 'Test selection options');
    var justificationLabel = el('label', 'wl-label', 'Justification for your chosen test');
    justificationLabel.setAttribute('for', uid + '-justification');
    var justification = el('textarea', 'wl-textarea');
    justification.id = uid + '-justification';
    justification.rows = 3;
    justification.addEventListener('input', function () {
      state.justification = justification.value;
    });
    (lab.testSelectionOptions || []).forEach(function (option) {
      var wrap = el('div', 'wl-test-option');
      var button = el('button', 'wl-button', option.label);
      button.type = 'button';
      button.setAttribute('data-test-id', option.id);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        state.selectedTest = option.id;
        Array.prototype.forEach.call(testGroup.querySelectorAll('[data-test-id]'), function (other) {
          other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
        });
        say('Test selected: ' + option.label + '. Now justify the choice in writing.');
      });
      wrap.append(button, el('p', 'wl-hint', option.justificationPrompt));
      testGroup.append(wrap);
    });
    testSection.append(testGroup, justificationLabel, justification);

    // ---- worksheet ----------------------------------------------------------
    var worksheetSection = section(uid + '-worksheet', 'Evidence worksheet', rootEl);
    worksheetSection.append(el('p', 'wl-hint', 'Required report fields: ' + (lab.evidenceWorksheet.requiredFields || []).join(', ') + '.'));
    (lab.evidenceWorksheet.prompts || []).forEach(function (prompt, index) {
      var label = el('label', 'wl-label', prompt);
      label.setAttribute('for', uid + '-prompt-' + index);
      var field = el('textarea', 'wl-textarea');
      field.id = uid + '-prompt-' + index;
      field.rows = 3;
      field.setAttribute('data-worksheet-prompt', String(index));
      field.addEventListener('input', function () {
        state.notes[index] = field.value;
      });
      worksheetSection.append(label, field);
    });

    // ---- repair verification ------------------------------------------------
    var repairSection = section(uid + '-repair', 'Repair verification plan', rootEl);
    var repairSteps = el('ol', 'wl-list');
    (lab.repairVerification.steps || []).forEach(function (step) { repairSteps.append(el('li', null, step)); });
    var evidenceList = el('ul', 'wl-list');
    (lab.repairVerification.expectedEvidence || []).forEach(function (item) { evidenceList.append(el('li', null, item)); });
    repairSection.append(repairSteps, el('p', 'wl-hint', 'Expected verification evidence:'), evidenceList);

    // ---- sources ------------------------------------------------------------
    var sourceSection = section(uid + '-sources', 'Sources, provenance and review status', rootEl);
    sourceSection.append(el('p', 'wl-hint',
      'Reproduction rights for external references remain unverified. Only metadata pointers are recorded; no third-party content is reproduced.'));
    sourceSection.append(table(
      [
        { label: 'Source', cell: function (r) { return r.id; } },
        { label: 'Kind', cell: function (r) { return r.kind; } },
        { label: 'Title', cell: function (r) { return r.title || 'not supplied'; } },
        { label: 'Citation status', cell: function (r) { return r.citationStatus; } },
        { label: 'Rights status', cell: function (r) { return r.rightsStatus; } }
      ],
      lab.sources || [],
      'No sources recorded.'
    ));

    // ---- accessibility ------------------------------------------------------
    var a11ySection = section(uid + '-a11y', 'Accessibility', rootEl);
    a11ySection.append(definitionList([['Keyboard path', lab.accessibility.keyboardPath]]));
    var altList = el('ul', 'wl-list');
    (lab.accessibility.textAlternatives || []).forEach(function (item) { altList.append(el('li', null, item)); });
    var a11yNotes = el('ul', 'wl-list');
    (lab.accessibility.notes || []).forEach(function (item) { a11yNotes.append(el('li', null, item)); });
    a11ySection.append(el('p', 'wl-hint', 'Text alternatives:'), altList, el('p', 'wl-hint', 'Notes:'), a11yNotes);

    // ---- review checklist ---------------------------------------------------
    var checklistSection = section(uid + '-checklist', 'Technical and rights review checklist (open items)', rootEl);
    checklistSection.append(table(
      [
        { label: 'Item', cell: function (r) { return r.id; } },
        { label: 'Statement', cell: function (r) { return r.statement; } },
        { label: 'Status', cell: function (r) { return r.status; } }
      ],
      lab.technicalReviewChecklist || [],
      'No checklist supplied.'
    ));


    // ---- local summary ------------------------------------------------------
    var summarySection = section(uid + '-summary', 'Your local evidence summary', rootEl);
    summarySection.append(el('p', 'wl-hint',
      'This summary stays in your browser. It is not submitted, stored, graded, or sent anywhere, and it is not an assessment record.'));
    var preview = el('pre', 'wl-summary');
    preview.id = uid + '-summary-output';
    preview.tabIndex = 0;
    preview.setAttribute('aria-label', 'Local evidence summary output');
    preview.textContent = 'Nothing summarised yet.';
    var row = el('div', 'wl-row');
    var summarise = el('button', 'wl-button', 'Build local summary');
    summarise.type = 'button';
    summarise.addEventListener('click', function () {
      var summary = {
        labId: lab.labId,
        week: lab.week,
        title: lab.title,
        assessmentEligible: false,
        autoGradingEnabled: false,
        published: false,
        hypothesisSelected: state.hypothesisChoice || null,
        testSelected: state.selectedTest || null,
        testJustification: state.justification || null,
        worksheetResponses: Object.keys(state.notes).map(function (key) {
          return { promptIndex: Number(key), response: state.notes[key] };
        })
      };
      preview.textContent = JSON.stringify(summary, null, 2);
      say('Local summary built in the browser. Nothing was stored or submitted.');
    });
    var clear = el('button', 'wl-button', 'Clear my entries');
    clear.type = 'button';
    clear.addEventListener('click', function () {
      state.selectedTest = null;
      state.justification = '';
      state.hypothesisChoice = '';
      state.notes = {};
      choice.value = '';
      justification.value = '';
      Array.prototype.forEach.call(rootEl.querySelectorAll('.wl-textarea'), function (field) { field.value = ''; });
      Array.prototype.forEach.call(testGroup.querySelectorAll('[data-test-id]'), function (other) { other.setAttribute('aria-pressed', 'false'); });
      preview.textContent = 'Nothing summarised yet.';
      say('Local entries cleared. Nothing was stored.');
    });
    row.append(summarise, clear);
    summarySection.append(row, preview);

    // ---- flags notice -------------------------------------------------------
    var flagsNotice = el('p', 'wl-flags');
    flagsNotice.textContent = 'Approval flags: assessmentEligible=' + lab.flags.assessmentEligible
      + ', autoGradingEnabled=' + lab.flags.autoGradingEnabled
      + ', published=' + lab.flags.published
      + ', smeApproved=' + lab.flags.smeApproved
      + ', rightsApproved=' + lab.flags.rightsApproved
      + '. All must remain false until separately authorized.';
    rootEl.append(flagsNotice, statusEl);

    say('Lab loaded from the supplied package. No data has been stored or submitted.');

    return {
      ASSET_ID: 'aut250-weekly-lab-runtime',
      mount: rootEl,
      labId: lab.labId,
      mountedInstruments: mountedInstruments,
      getState: function () {
        return {
          hypothesisChoice: state.hypothesisChoice,
          selectedTest: state.selectedTest,
          justification: state.justification,
          worksheetResponses: Object.keys(state.notes).length
        };
      },
      getSummary: function () { return preview.textContent; },
      destroy: function () { rootEl.remove(); }
    };
  }

  return { createWeeklyLab: createWeeklyLab, AVAILABILITY_LABELS: AVAILABILITY_LABELS };
});


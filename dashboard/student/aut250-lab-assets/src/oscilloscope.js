/**
 * AUT-250 Interactive Laboratory Assets — virtual automotive oscilloscope.
 *
 * Renders ONLY waveform samples supplied through setChannels(). The scope
 * performs display scaling and descriptive statistics on supplied data. It
 * never asserts a fault, a pass/fail verdict, or a diagnostic conclusion, and
 * it never invents samples when data is absent.
 *
 * UMD: window.Aut250LabAssets.Oscilloscope and require().
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
    root.Aut250LabAssets.Oscilloscope = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (DC, SD) {
  'use strict';

  var DIVISIONS_X = 10;
  var DIVISIONS_Y = 8;
  var CHANNEL_CLASSES = ['tm-trace--a', 'tm-trace--b', 'tm-trace--c', 'tm-trace--d'];
  var instanceSeq = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return String(Math.round(value * 1000) / 1000);
  }

  function normalizeChannel(raw, index) {
    if (!DC.isPlainObject(raw)) {
      return { ok: false, issues: ['Channel entry must be an object.'], channel: null };
    }
    if (!DC.nonEmptyString(raw.id)) {
      return { ok: false, issues: ['Channel requires an id.'], channel: null };
    }
    var samples = SD.normalizeSamples(raw.samples);
    if (!samples.ok) {
      var reason = samples.issues.length ? samples.issues.join(' ') : 'Channel requires at least one valid sample.';
      return { ok: false, issues: [reason], channel: null };
    }
    var vertical = null;
    if (DC.isPlainObject(raw.vertical) && DC.finiteNumber(raw.vertical.min) && DC.finiteNumber(raw.vertical.max)
      && raw.vertical.max > raw.vertical.min) {
      vertical = { min: raw.vertical.min, max: raw.vertical.max };
    }
    return {
      ok: true,
      issues: samples.issues,
      channel: {
        id: raw.id,
        label: DC.nonEmptyString(raw.label) ? raw.label : raw.id,
        unit: DC.nonEmptyString(raw.unit) ? raw.unit : null,
        timeUnit: DC.nonEmptyString(raw.timeUnit) ? raw.timeUnit : null,
        samples: samples.samples,
        vertical: vertical,
        stats: SD.computeStats(samples.samples),
        traceClass: CHANNEL_CLASSES[index % CHANNEL_CLASSES.length],
        visible: true
      }
    };
  }

  /**
   * @param {{mount: Element}} options
   */
  function createOscilloscope(options) {
    var opts = options || {};
    var mount = opts.mount;
    if (!mount) throw new Error('Oscilloscope requires a mount element.');
    var uid = 'scope-' + (instanceSeq += 1);

    var state = {
      channels: [],
      issues: [],
      trigger: { channelId: null, level: null, edge: 'rising' },
      timebase: null,
      verticalScale: {},
      running: true,
      progress: 1
    };

    var rootEl = el('section', 'tm-scope');
    rootEl.setAttribute('aria-labelledby', uid + '-title');

    var header = el('header', 'tm-asset__header');
    var title = el('h3', 'tm-asset__title', 'Automotive oscilloscope');
    title.id = uid + '-title';
    header.append(title, el('p', 'tm-asset__badge', 'SIMULATED DISPLAY · waveforms are supplied by an external scenario data interface'));

    var body = el('div', 'tm-scope__body');

    var display = el('div', 'tm-scope__display');
    var canvas = el('canvas', 'tm-scope__canvas');
    canvas.width = 480;
    canvas.height = 260;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Oscilloscope waveform display. A text description of the supplied waveform follows the display.');
    var statusEl = el('p', 'tm-scope__status', 'No waveform data supplied');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    display.append(canvas, statusEl);

    var controls = el('div', 'tm-scope__controls');

    var channelFieldset = el('fieldset', 'tm-asset__fieldset');
    channelFieldset.append(el('legend', null, 'Signal channels'));
    var channelList = el('div', 'tm-scope__channel-list');
    channelFieldset.append(channelList);

    var triggerFieldset = el('fieldset', 'tm-asset__fieldset');
    triggerFieldset.append(el('legend', null, 'Trigger'));
    var triggerChannelLabel = el('label', 'tm-asset__label', 'Source channel');
    triggerChannelLabel.setAttribute('for', uid + '-trigger-channel');
    var triggerChannelSelect = el('select', 'tm-asset__select');
    triggerChannelSelect.id = uid + '-trigger-channel';
    triggerChannelSelect.disabled = true;
    var triggerLevelLabel = el('label', 'tm-asset__label', 'Trigger level (supplied units)');
    triggerLevelLabel.setAttribute('for', uid + '-trigger-level');
    var triggerLevelInput = el('input', 'tm-asset__input');
    triggerLevelInput.id = uid + '-trigger-level';
    triggerLevelInput.type = 'number';
    triggerLevelInput.step = 'any';
    triggerLevelInput.disabled = true;
    var triggerEdgeLabel = el('label', 'tm-asset__label', 'Edge');
    triggerEdgeLabel.setAttribute('for', uid + '-trigger-edge');
    var triggerEdgeSelect = el('select', 'tm-asset__select');
    triggerEdgeSelect.id = uid + '-trigger-edge';
    triggerEdgeSelect.append(new Option('Rising', 'rising'), new Option('Falling', 'falling'));
    var triggerAutoButton = el('button', 'tm-asset__button', 'Auto level from supplied data');
    triggerAutoButton.type = 'button';
    triggerAutoButton.disabled = true;
    triggerFieldset.append(triggerChannelLabel, triggerChannelSelect, triggerLevelLabel, triggerLevelInput,
      triggerEdgeLabel, triggerEdgeSelect, triggerAutoButton);

    var scaleFieldset = el('fieldset', 'tm-asset__fieldset');
    scaleFieldset.append(el('legend', null, 'Scales'));
    var timebaseLabel = el('label', 'tm-asset__label', 'Time per division');
    timebaseLabel.setAttribute('for', uid + '-timebase');
    var timebaseInput = el('input', 'tm-asset__input');
    timebaseInput.id = uid + '-timebase';
    timebaseInput.type = 'number';
    timebaseInput.step = 'any';
    timebaseInput.min = '0.0001';
    var timebaseHint = el('p', 'tm-asset__hint', 'Auto scale from supplied data.');
    var verticalList = el('div', 'tm-scope__scale-list');
    scaleFieldset.append(timebaseLabel, timebaseInput, timebaseHint, verticalList);

    var transport = el('div', 'tm-scope__transport');
    var runButton = el('button', 'tm-asset__button', 'Pause');
    runButton.type = 'button';
    runButton.setAttribute('aria-pressed', 'false');
    transport.append(runButton);

    var issuesEl = el('p', 'tm-asset__issues', '');
    issuesEl.setAttribute('role', 'status');
    issuesEl.setAttribute('aria-live', 'polite');

    controls.append(channelFieldset, triggerFieldset, scaleFieldset, transport, issuesEl);
    body.append(display, controls);

    var textPanel = el('div', 'tm-scope__text');
    textPanel.append(el('h4', null, 'Text description of the supplied waveform'));
    var descriptionEl = el('p', 'tm-scope__description', 'No waveform data supplied.');
    descriptionEl.setAttribute('role', 'status');
    descriptionEl.setAttribute('aria-live', 'polite');
    var details = el('details', 'tm-scope__details');
    details.append(el('summary', null, 'Supplied sample table (non-visual alternative)'));

    function visibleChannels() {
      return state.channels.filter(function (channel) { return channel.visible; });
    }

    function channelById(id) {
      for (var i = 0; i < state.channels.length; i += 1) {
        if (state.channels[i].id === id) return state.channels[i];
      }
      return null;
    }

    function autoTimebase() {
      var channels = visibleChannels();
      var span = 0;
      channels.forEach(function (channel) {
        if (channel.stats && channel.stats.span > span) span = channel.stats.span;
      });
      return span > 0 ? span / DIVISIONS_X : null;
    }

    function effectiveTimebase() {
      if (DC.finiteNumber(state.timebase) && state.timebase > 0) return state.timebase;
      return autoTimebase();
    }

    function autoVerticalScale(channel) {
      if (channel.vertical) return (channel.vertical.max - channel.vertical.min) / DIVISIONS_Y;
      if (channel.stats && channel.stats.peakToPeak > 0) return channel.stats.peakToPeak / DIVISIONS_Y;
      return null;
    }

    function effectiveVerticalScale(channel) {
      var manual = state.verticalScale[channel.id];
      if (DC.finiteNumber(manual) && manual > 0) return manual;
      return autoVerticalScale(channel);
    }

    function verticalBase(channel) {
      if (channel.vertical) return channel.vertical.min;
      if (channel.stats) return channel.stats.min;
      return 0;
    }

    function drawGrid(ctx, width, height) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#04101f';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(90, 160, 220, 0.28)';
      ctx.lineWidth = 1;
      for (var x = 0; x <= DIVISIONS_X; x += 1) {
        var px = (x / DIVISIONS_X) * width;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }
      for (var y = 0; y <= DIVISIONS_Y; y += 1) {
        var py = (y / DIVISIONS_Y) * height;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }
    }

    function drawTriggerMarker(ctx, width, height, channel, timebase, scale) {
      if (!channel || !channel.stats) return;
      var level = state.trigger.level;
      if (!DC.finiteNumber(level)) return;
      var base = verticalBase(channel);
      var y = (height / 2) - ((level - base) / scale) * (height / DIVISIONS_Y);
      if (y < 0 || y > height) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 214, 102, 0.85)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.restore();
    }

    var tableHost = el('div', 'tm-scope__table');
    details.append(tableHost);
    textPanel.append(descriptionEl, details,
      el('p', 'tm-asset__note', 'Statistics describe the supplied samples only. No diagnostic conclusion is drawn and no interpretation is graded.'));

    rootEl.append(header, body, textPanel);
    mount.append(rootEl);


    function renderCanvas() {
      var ctx = null;
      try {
        if (typeof canvas.getContext !== 'function') return;
        ctx = canvas.getContext('2d');
      } catch (error) {
        // Canvas is unavailable (for example in a text-only environment).
        // The text description and sample table remain the accessible record.
        return;
      }
      if (!ctx) return;
      var width = canvas.width;
      var height = canvas.height;
      drawGrid(ctx, width, height);
      var timebase = effectiveTimebase();
      if (!timebase) return;
      var triggerChannel = channelById(state.trigger.channelId);
      var triggerScale = triggerChannel ? effectiveVerticalScale(triggerChannel) : null;
      if (triggerChannel && triggerScale) {
        drawTriggerMarker(ctx, width, height, triggerChannel, timebase, triggerScale);
      }
      drawTraces(ctx);
    }

    function drawTraces(ctx) {
      var styles = { 'tm-trace--a': '#59ff9c', 'tm-trace--b': '#6cc7ff', 'tm-trace--c': '#ffd666', 'tm-trace--d': '#ff9ecd' };
      var timebase = effectiveTimebase();
      if (!timebase) return;
      visibleChannels().forEach(function (channel) {
        var scale = effectiveVerticalScale(channel);
        if (!scale) return;
        var stats = channel.stats;
        var base = verticalBase(channel);
        var usable = Math.max(1, Math.floor(channel.samples.length * state.progress));
        ctx.strokeStyle = styles[channel.traceClass] || '#59ff9c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var i = 0; i < usable; i += 1) {
          var sample = channel.samples[i];
          var x = ((sample.t - stats.firstT) / (timebase * DIVISIONS_X)) * canvas.width;
          var y = (canvas.height / 2) - ((sample.v - base) / scale) * (canvas.height / DIVISIONS_Y);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    }

    function buildChannelControls() {
      channelList.replaceChildren();
      triggerChannelSelect.replaceChildren();
      verticalList.replaceChildren();
      if (state.channels.length === 0) {
        channelList.append(el('p', 'tm-asset__hint', 'No channels supplied.'));
        triggerChannelSelect.disabled = true;
        triggerLevelInput.disabled = true;
        triggerAutoButton.disabled = true;
        return;
      }
      state.channels.forEach(function (channel) {
        var wrap = el('label', 'tm-scope__channel');
        var toggle = el('input', 'tm-scope__channel-toggle');
        toggle.type = 'checkbox';
        toggle.checked = channel.visible;
        toggle.setAttribute('data-channel-id', channel.id);
        toggle.addEventListener('change', function () {
          channel.visible = toggle.checked;
          renderAll();
        });
        var swatch = el('span', 'tm-scope__swatch ' + channel.traceClass);
        wrap.append(toggle, swatch, el('span', null, channel.label + (channel.unit ? ' (' + channel.unit + ')' : '')));
        channelList.append(wrap);

        triggerChannelSelect.append(new Option(channel.label, channel.id));

        var scaleLabel = el('label', 'tm-asset__label', 'Vertical scale — ' + channel.label);
        scaleLabel.setAttribute('for', uid + '-vs-' + channel.id);
        var scaleInput = el('input', 'tm-asset__input');
        scaleInput.id = uid + '-vs-' + channel.id;
        scaleInput.type = 'number';
        scaleInput.step = 'any';
        scaleInput.min = '0.0001';
        var auto = autoVerticalScale(channel);
        scaleInput.value = auto === null ? '' : String(Math.round(auto * 1000) / 1000);
        scaleInput.addEventListener('change', function () {
          var parsed = Number(scaleInput.value);
          if (Number.isFinite(parsed) && parsed > 0) state.verticalScale[channel.id] = parsed;
          else delete state.verticalScale[channel.id];
          renderAll();
        });
        verticalList.append(scaleLabel, scaleInput);
      });

      if (!state.trigger.channelId || !channelById(state.trigger.channelId)) {
        state.trigger.channelId = state.channels[0].id;
        var first = state.channels[0].stats;
        if (first && !DC.finiteNumber(state.trigger.level)) {
          state.trigger.level = Math.round(((first.min + first.max) / 2) * 1000) / 1000;
        }
      }
      triggerChannelSelect.value = state.trigger.channelId;
      triggerChannelSelect.disabled = false;
      triggerLevelInput.disabled = false;
      triggerAutoButton.disabled = false;
      triggerLevelInput.value = DC.finiteNumber(state.trigger.level) ? String(state.trigger.level) : '';
      triggerEdgeSelect.value = state.trigger.edge;
      var timebase = effectiveTimebase();
      timebaseInput.value = timebase === null ? '' : String(Math.round(timebase * 10000) / 10000);
    }


    function describeChannel(channel) {
      var stats = channel.stats;
      var unit = channel.unit ? ' ' + channel.unit : '';
      var timeUnit = channel.timeUnit ? ' ' + channel.timeUnit : '';
      var timebase = effectiveTimebase();
      var scale = effectiveVerticalScale(channel);
      var parts = [
        channel.label + ': ' + stats.count + ' supplied samples from ' + formatNumber(stats.firstT) + ' to '
          + formatNumber(stats.lastT) + timeUnit + ' (span ' + formatNumber(stats.span) + timeUnit + ').',
        'Minimum ' + formatNumber(stats.min) + unit + ', maximum ' + formatNumber(stats.max) + unit
          + ', peak-to-peak ' + formatNumber(stats.peakToPeak) + unit + ', mean ' + formatNumber(stats.mean) + unit + '.',
        'Displayed at ' + (scale === null ? 'no vertical scale' : formatNumber(scale) + unit + ' per division')
          + ' and ' + (timebase === null ? 'no time scale' : formatNumber(timebase) + timeUnit + ' per division') + '.'
      ];
      return parts.join(' ');
    }

    function describeTrigger() {
      var channel = channelById(state.trigger.channelId);
      if (!channel) return 'Trigger: no source channel supplied.';
      if (!DC.finiteNumber(state.trigger.level)) return 'Trigger: no level supplied.';
      var result = SD.findTrigger(channel.samples, state.trigger.level, state.trigger.edge);
      if (!result.found) return 'Trigger: ' + result.reason;
      return 'Trigger: ' + result.edge + ' crossing of ' + formatNumber(result.level)
        + (channel.unit ? ' ' + channel.unit : '') + ' found at ' + formatNumber(result.t)
        + (channel.timeUnit ? ' ' + channel.timeUnit : '') + ' in the supplied samples.';
    }

    function updateText() {
      var channels = state.channels;
      if (channels.length === 0) {
        descriptionEl.textContent = 'No waveform data supplied.';
        tableHost.replaceChildren();
        canvas.setAttribute('aria-label', 'Oscilloscope display is empty because no waveform data was supplied.');
        return;
      }
      var lines = channels.map(function (channel) {
        return (channel.visible ? '' : '[hidden] ') + describeChannel(channel);
      });
      lines.push(describeTrigger());
      descriptionEl.textContent = lines.join(' ');
      canvas.setAttribute('aria-label', 'Oscilloscope display. ' + lines.join(' '));
      buildTable(channels[0]);
    }

    function buildTable(channel) {
      var limit = 50;
      var table = el('table', 'tm-scope__sample-table');
      var head = el('tr');
      head.append(el('th', null, 't' + (channel.timeUnit ? ' (' + channel.timeUnit + ')' : '')),
        el('th', null, 'value' + (channel.unit ? ' (' + channel.unit + ')' : '')));
      table.append(head);
      var rows = channel.samples.slice(0, limit);
      rows.forEach(function (sample) {
        var row = el('tr');
        row.append(el('td', null, formatNumber(sample.t)), el('td', null, formatNumber(sample.v)));
        table.append(row);
      });
      var caption = channel.label + ' — showing ' + rows.length + ' of ' + channel.samples.length + ' supplied samples';
      tableHost.replaceChildren(el('p', 'tm-asset__hint', caption), table);
    }

    function renderAll() {
      renderCanvas();
      updateText();
      statusEl.textContent = state.channels.length === 0
        ? 'No waveform data supplied'
        : (state.running ? 'Running — rendering supplied samples' : 'Paused');
      issuesEl.textContent = state.issues.length ? state.issues.join(' ') : '';
    }

    function prefersReducedMotion() {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (error) {
        return false;
      }
    }

    function animate() {
      // Text output must never wait for animation: render immediately, then
      // progressively reveal the canvas trace when motion is acceptable.
      var shouldAnimate = state.running && state.channels.length > 0 && !prefersReducedMotion();
      state.progress = shouldAnimate ? 0 : 1;
      renderAll();
      if (!shouldAnimate) return;
      var started = null;
      var duration = 700;
      function step(timestamp) {
        if (!state.running) {
          state.progress = 1;
          renderAll();
          return;
        }
        if (started === null) started = timestamp;
        var ratio = Math.min(1, (timestamp - started) / duration);
        state.progress = ratio;
        renderAll();
        if (ratio < 1 && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(step);
        }
      }
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(step);
      } else {
        state.progress = 1;
        renderAll();
      }
    }


    function applyTriggerLevelFromChannel() {
      var channel = channelById(state.trigger.channelId);
      if (!channel || !channel.stats) return;
      state.trigger.level = Math.round(((channel.stats.min + channel.stats.max) / 2) * 1000) / 1000;
      triggerLevelInput.value = String(state.trigger.level);
    }

    triggerChannelSelect.addEventListener('change', function () {
      state.trigger.channelId = triggerChannelSelect.value;
      applyTriggerLevelFromChannel();
      renderAll();
    });
    triggerLevelInput.addEventListener('change', function () {
      var parsed = Number(triggerLevelInput.value);
      if (Number.isFinite(parsed)) state.trigger.level = parsed;
      renderAll();
    });
    triggerEdgeSelect.addEventListener('change', function () {
      state.trigger.edge = triggerEdgeSelect.value === 'falling' ? 'falling' : 'rising';
      renderAll();
    });
    triggerAutoButton.addEventListener('click', function () {
      applyTriggerLevelFromChannel();
      renderAll();
    });
    timebaseInput.addEventListener('change', function () {
      var parsed = Number(timebaseInput.value);
      if (Number.isFinite(parsed) && parsed > 0) state.timebase = parsed;
      else state.timebase = null;
      buildChannelControls();
      renderAll();
    });
    runButton.addEventListener('click', function () { api.setRunning(!state.running); });

    var api = {
      ASSET_ID: 'aut250-lab-asset-oscilloscope',
      mount: rootEl,
      setChannels: function (raw) {
        var issues = [];
        var channels = [];
        DC.asArray(raw).forEach(function (entry, index) {
          var result = normalizeChannel(entry, index);
          if (!result.ok) {
            issues = issues.concat(result.issues);
            return;
          }
          issues = issues.concat(result.issues);
          channels.push(result.channel);
        });
        state.channels = channels;
        state.issues = issues;
        state.verticalScale = {};
        state.trigger.channelId = null;
        state.trigger.level = null;
        buildChannelControls();
        animate();
        return { ok: channels.length > 0, issues: issues, channelCount: channels.length };
      },
      setVisible: function (id, visible) {
        var channel = channelById(id);
        if (!channel) return { ok: false, reason: 'Unknown channel: ' + String(id) };
        channel.visible = Boolean(visible);
        buildChannelControls();
        renderAll();
        return { ok: true };
      },
      setTrigger: function (trigger) {
        if (!DC.isPlainObject(trigger)) return { ok: false, reason: 'Trigger must be an object.' };
        if (trigger.channelId !== undefined) {
          if (!channelById(trigger.channelId)) return { ok: false, reason: 'Unknown trigger channel: ' + String(trigger.channelId) };
          state.trigger.channelId = trigger.channelId;
        }
        if (trigger.level !== undefined) {
          if (!DC.finiteNumber(trigger.level)) return { ok: false, reason: 'Trigger level must be a finite number.' };
          state.trigger.level = trigger.level;
        }
        if (trigger.edge !== undefined) {
          if (trigger.edge !== 'rising' && trigger.edge !== 'falling') {
            return { ok: false, reason: 'Trigger edge must be "rising" or "falling".' };
          }
          state.trigger.edge = trigger.edge;
        }
        buildChannelControls();
        renderAll();
        return { ok: true };
      },

      setTimebase: function (value) {
        if (value === null) {
          state.timebase = null;
          buildChannelControls();
          renderAll();
          return { ok: true };
        }
        if (!DC.finiteNumber(value) || value <= 0) {
          return { ok: false, reason: 'Time per division must be a positive number.' };
        }
        state.timebase = value;
        buildChannelControls();
        renderAll();
        return { ok: true };
      },
      setVerticalScale: function (id, value) {
        if (!channelById(id)) return { ok: false, reason: 'Unknown channel: ' + String(id) };
        if (!DC.finiteNumber(value) || value <= 0) {
          return { ok: false, reason: 'Vertical scale must be a positive number.' };
        }
        state.verticalScale[id] = value;
        renderAll();
        return { ok: true };
      },
      setRunning: function (running) {
        state.running = Boolean(running);
        runButton.textContent = state.running ? 'Pause' : 'Resume';
        runButton.setAttribute('aria-pressed', state.running ? 'false' : 'true');
        if (state.running) animate();
        else {
          state.progress = 1;
          renderAll();
        }
        return { ok: true, running: state.running };
      },
      isRunning: function () { return state.running; },
      getTriggerResult: function () {
        var channel = channelById(state.trigger.channelId);
        if (!channel || !DC.finiteNumber(state.trigger.level)) {
          return { found: false, index: null, reason: 'No source channel or trigger level supplied.' };
        }
        return SD.findTrigger(channel.samples, state.trigger.level, state.trigger.edge);
      },
      getState: function () {
        return {
          channels: state.channels.map(function (channel) {
            return {
              id: channel.id,
              label: channel.label,
              unit: channel.unit,
              visible: channel.visible,
              stats: channel.stats,
              sampleCount: channel.samples.length
            };
          }),
          trigger: { channelId: state.trigger.channelId, level: state.trigger.level, edge: state.trigger.edge },
          timebase: effectiveTimebase(),
          running: state.running,
          issues: state.issues.slice()
        };
      },
      renderNow: function () { state.progress = 1; renderAll(); },
      destroy: function () { rootEl.remove(); }
    };

    buildChannelControls();
    renderAll();
    return api;
  }

  return { createOscilloscope: createOscilloscope };
});


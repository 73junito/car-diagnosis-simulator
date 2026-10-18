/**
 * AUT-250 Interactive Laboratory Assets — standalone showcase wiring.
 *
 * Demonstrates each asset with ILLUSTRATIVE DEMO INPUT only. No asset is
 * connected to the student laboratory, the diagnostic engine, an assessment
 * system, or a database.
 *
 * UMD: window.Aut250AssetShowcase and require() (boot requires a DOM).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Aut250AssetShowcase = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var booted = null;

  function boot() {
    if (booted) return booted;
    var namespace = typeof window !== 'undefined' ? window.Aut250LabAssets : null;
    var demo = typeof window !== 'undefined' ? window.Aut250DemoScenario : null;
    var statusEl = document.getElementById('showcaseStatus');
    function say(message) {
      if (statusEl) statusEl.textContent = message;
    }
    if (!namespace || !demo) {
      say('Asset modules or demo payload unavailable.');
      return null;
    }

    var assets = {
      multimeter: namespace.Multimeter.createMultimeter({ mount: document.getElementById('multimeterHost') }),
      oscilloscope: namespace.Oscilloscope.createOscilloscope({ mount: document.getElementById('scopeHost') }),
      scanTool: namespace.ScanTool.createScanTool({ mount: document.getElementById('scanHost') }),
      components: namespace.VehicleComponents.createComponentLibrary({
        mount: document.getElementById('partsHost'),
        onSelect: function (component) {
          say('Inspecting supplied component: ' + component.label + '.');
        }
      })
    };

    function on(id, handler) {
      var element = document.getElementById(id);
      if (element) element.addEventListener('click', handler);
    }

    function supplyMultimeter() {
      demo.multimeter.measurements.forEach(function (measurement) {
        assets.multimeter.setMeasurement(measurement);
      });
      say('Illustrative demonstration measurements supplied. The multimeter displays only supplied values.');
    }

    function supplyWaveforms() {
      var result = assets.oscilloscope.setChannels(demo.oscilloscope.channels);
      say('Illustrative demonstration waveforms supplied: ' + result.channelCount + ' channel(s). '
        + (result.issues.length ? result.issues.join(' ') : ''));
    }

    function supplyScan() {
      var result = assets.scanTool.setData(demo.scanTool);
      say('Illustrative demonstration scan data supplied: ' + result.counts.dtcs + ' code(s). '
        + (result.issues.length ? result.issues.join(' ') : ''));
    }

    function supplyComponents() {
      var result = assets.components.setComponents(demo.components);
      say('Illustrative demonstration components supplied: ' + result.componentCount + ' item(s). '
        + (result.issues.length ? result.issues.join(' ') : ''));
    }

    function loadDemo() {
      supplyMultimeter();
      supplyWaveforms();
      supplyScan();
      supplyComponents();
      say('Illustrative demonstration data supplied to all four assets. All values remain invented demo input.');
    }

    function clearAll() {
      assets.multimeter.setMeasurement(null);
      assets.oscilloscope.setChannels([]);
      assets.scanTool.clear();
      assets.components.setComponents([]);
      say('All supplied data cleared. Assets now show explicit "not supplied" states.');
    }

    function loadUnsupported() {
      var measurement = assets.multimeter.setMeasurement(demo.multimeter.unsupportedExample);
      var waveforms = assets.oscilloscope.setChannels([
        {
          id: 'demo-broken-channel',
          label: 'Illustrative malformed channel (demo)',
          samples: [{ t: 0, v: 1 }, { t: 'invalid', v: 2 }]
        }
      ]);
      var scan = assets.scanTool.setData({
        dtcs: [{ description: 'Illustrative entry with no code (demo)' }],
        liveData: [{ label: 'Illustrative entry with no value (demo)' }],
        misfireCounters: [{ cylinder: 'Illustrative cylinder (demo)', count: 'not-a-number' }],
        repairVerification: { dtcCleared: 'unspecified' }
      });
      var components = assets.components.setComponents([
        { id: 'demo-unknown-category', label: 'Illustrative unsupported category (demo)', category: 'demo-unknown-category' },
        { label: 'Illustrative entry with no id (demo)' }
      ]);
      var issues = measurement.issues.concat(waveforms.issues, scan.issues, components.issues);
      say('Unsupported input demonstrated. The assets rejected it and reported: '
        + issues.join(' ') + ' No substitute value was invented.');
    }

    on('loadDemo', loadDemo);
    on('clearAll', clearAll);
    on('loadUnsupported', loadUnsupported);
    on('supplyVoltage', function () {
      assets.multimeter.setMeasurement(demo.multimeter.measurements[0]);
      say('Illustrative voltage supplied.');
    });
    on('supplyResistance', function () {
      assets.multimeter.setMeasurement(demo.multimeter.measurements[1]);
      say('Illustrative resistance supplied.');
    });
    on('supplyContinuity', function () {
      assets.multimeter.setMeasurement(demo.multimeter.measurements[2]);
      say('Illustrative continuity supplied.');
    });
    on('clearMeasurement', function () {
      assets.multimeter.setMeasurement(null);
      say('Multimeter measurement cleared.');
    });
    on('supplyWaveforms', supplyWaveforms);
    on('clearWaveforms', function () {
      assets.oscilloscope.setChannels([]);
      say('Waveform data cleared.');
    });
    on('supplyScan', supplyScan);
    on('clearScan', function () {
      assets.scanTool.clear();
      say('Scan data cleared.');
    });
    on('supplyComponents', supplyComponents);
    on('clearComponents', function () {
      assets.components.setComponents([]);
      say('Component data cleared.');
    });
    on('highlightAll', function () {
      var state = assets.components.getState();
      var highlighted = 0;
      state.components.forEach(function (component) {
        if (assets.components.setHighlight(component.id, true).ok) highlighted += 1;
      });
      say('Highlighted ' + highlighted + ' supplied component(s). Highlighting is presentation state only.');
    });

    say('Assets ready. No data supplied yet. Use "Load illustrative demo data" to demonstrate supplied input.');
    booted = assets;
    return assets;
  }

  function autoBoot() {
    if (typeof document === 'undefined') return null;
    if (!document.getElementById('assetShowcase')) return null;
    return boot();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoBoot);
    } else {
      autoBoot();
    }
  }

  return { boot: boot, autoBoot: autoBoot };
});


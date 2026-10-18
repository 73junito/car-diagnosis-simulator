/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'dashboard', 'student', 'aut250-lab-assets');
const SCRIPTS = [
  'src/data-contract.js',
  'src/scenario-data.js',
  'src/multimeter.js',
  'src/oscilloscope.js',
  'src/scan-tool.js',
  'src/vehicle-components.js',
  'data/demo-scenario.js',
  'src/showcase.js'
];

function loadShowcase() {
  const html = fs.readFileSync(path.join(UI, 'index.html'), 'utf8');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = body ? body[1] : html;
  const source = SCRIPTS.map((file) => fs.readFileSync(path.join(UI, file), 'utf8')).join('\n;\n');
  const run = new Function('window', 'document', source);
  run(window, document);
  const showcase = window.Aut250AssetShowcase;
  showcase.autoBoot();
  return showcase;
}

describe('AUT-250 lab assets — standalone showcase', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.Aut250LabAssets;
    delete window.Aut250DemoScenario;
    delete window.Aut250AssetShowcase;
  });

  test('exposes all four assets and a single live status region', () => {
    const showcase = loadShowcase();
    const assets = showcase.boot();
    expect(Object.keys(assets).sort()).toEqual(['components', 'multimeter', 'oscilloscope', 'scanTool']);
    expect(document.getElementById('showcaseStatus').getAttribute('aria-live')).toBe('polite');
    expect(document.querySelectorAll('.tm-skip-link')).toHaveLength(1);
    expect(document.querySelector('#assetShowcase')).not.toBeNull();
    expect(assets.multimeter.ASSET_ID).toBe('aut250-lab-asset-multimeter');
    expect(assets.oscilloscope.ASSET_ID).toBe('aut250-lab-asset-oscilloscope');
    expect(assets.scanTool.ASSET_ID).toBe('aut250-lab-asset-scan-tool');
    expect(assets.components.ASSET_ID).toBe('aut250-lab-asset-vehicle-components');
  });

  test('boot is idempotent so assets are never duplicated', () => {
    const showcase = loadShowcase();
    const first = showcase.boot();
    const second = showcase.boot();
    expect(second).toBe(first);
    expect(document.querySelectorAll('#multimeterHost .tm-dmm')).toHaveLength(1);
    expect(document.querySelectorAll('#scopeHost .tm-scope')).toHaveLength(1);
  });

  test('the page labels everything as simulated illustrative demonstration input', () => {
    loadShowcase();
    const notice = document.querySelector('.tm-assets-notice').textContent;
    expect(notice).toMatch(/SIMULATED, DEVELOPMENTAL ASSETS/);
    expect(notice).toMatch(/invented illustrative demonstration input/);
    expect(notice).toMatch(/not a vehicle measurement/);
    expect(notice).toMatch(/no pass\/fail verdict/);
    const badge = document.querySelector('#multimeterHost .tm-asset__badge').textContent;
    expect(badge).toMatch(/SIMULATED DISPLAY/);
    expect(document.querySelector('#scopeHost .tm-asset__badge').textContent).toMatch(/external scenario data interface/);
    expect(document.querySelector('#scanHost .tm-asset__badge').textContent).toMatch(/external provider/);
  });

  test('every showcase control is a native, keyboard-reachable button', () => {
    loadShowcase();
    const controls = document.querySelectorAll('.tm-assets-control-row button');
    expect(controls.length).toBeGreaterThanOrEqual(11);
    controls.forEach((control) => {
      expect(control.tagName).toBe('BUTTON');
      expect(control.getAttribute('type')).toBe('button');
    });
  });

  test('loading the demo supplies data and clearing restores not-supplied states', () => {
    loadShowcase();
    document.getElementById('loadDemo').click();
    expect(document.getElementById('showcaseStatus').textContent).toMatch(/Illustrative demonstration data supplied/);
    expect(document.querySelector('#multimeterHost .tm-dmm__value').textContent).toMatch(/0\.4 ohm|CLOSED/);
    expect(document.querySelector('#scopeHost .tm-scope__sample-table')).not.toBeNull();
    expect(document.querySelector('#scanHost').textContent).toMatch(/DEMO-0001/);
    expect(document.querySelectorAll('#partsHost [data-component-id]').length).toBeGreaterThan(8);

    document.getElementById('clearAll').click();
    expect(document.getElementById('showcaseStatus').textContent).toMatch(/cleared/);
    expect(document.querySelector('#multimeterHost .tm-dmm__value').textContent).toMatch(/No measurement supplied/);
    expect(document.querySelector('#scanHost').textContent).toMatch(/No trouble codes supplied/);
    expect(document.querySelector('#partsHost').textContent).toMatch(/No components supplied/);
  });

  test('unsupported input is reported to the user without inventing values', () => {
    loadShowcase();
    document.getElementById('loadUnsupported').click();
    const status = document.getElementById('showcaseStatus').textContent;
    expect(status).toMatch(/Unsupported input demonstrated/);
    expect(status).toMatch(/No substitute value was invented/);
    expect(status).toMatch(/Unsupported measurement mode/);
    expect(status).toMatch(/unsupported category/);
    expect(document.querySelector('#multimeterHost .tm-dmm__value').textContent).toMatch(/No measurement supplied/);
  });

  test('highlight-all only affects supplied, highlightable components', () => {
    loadShowcase();
    document.getElementById('supplyComponents').click();
    document.getElementById('highlightAll').click();
    const highlighted = document.querySelectorAll('#partsHost .tm-part--highlighted');
    expect(highlighted.length).toBeGreaterThan(8);
    expect(document.getElementById('showcaseStatus').textContent).toMatch(/presentation state only/);
  });
});

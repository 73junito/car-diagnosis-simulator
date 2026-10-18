const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'dashboard', 'student', 'aut250-lab-assets');
const TESTS = path.join(ROOT, 'tests', 'aut250-lab-assets');

const SOURCE_FILES = [
  'src/data-contract.js',
  'src/scenario-data.js',
  'src/multimeter.js',
  'src/oscilloscope.js',
  'src/scan-tool.js',
  'src/vehicle-components.js',
  'src/showcase.js',
  'data/demo-scenario.js'
];

function read(file) {
  return fs.readFileSync(path.join(UI, file), 'utf8');
}

/** Remove block and line comments so boundary statements in prose are ignored. */
function code(file) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return [path.relative(ROOT, full).replace(/\\/g, '/')];
  });
}

describe('AUT-250 lab assets — ownership and boundary', () => {
  test('every asset file lives inside the two assigned directories', () => {
    const files = listFiles(UI);
    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => {
      expect(file).toMatch(/^dashboard\/student\/aut250-lab-assets\/(index\.html|lab-assets\.css|src\/[a-z-]+\.js|data\/[a-z-]+\.js|(README|INTEGRATION|ACCESSIBILITY|PERFORMANCE)\.md)$/);
    });
    const testFiles = listFiles(TESTS);
    expect(testFiles.length).toBeGreaterThan(0);
    testFiles.forEach((file) => {
      expect(file).toMatch(/^tests\/aut250-lab-assets\/[a-z0-9-]+\.test\.js$/);
    });
  });

  test('assets are independent of the student lab, the diagnostic engine, and production systems', () => {
    const combined = SOURCE_FILES.map(code).join('\n').toLowerCase();
    const banned = [
      'aut250-lab-ui', 'aut250misfirelab', 'diagnosticengine', 'supabase', 'wrangler',
      'drizzle', 'migration', 'gradebook', 'dcaf', 'assessment_eligible', 'scoring'
    ];
    banned.forEach((term) => expect(combined).not.toContain(term));
  });

  test('assets perform no network, storage, or randomness behaviour', () => {
    const combined = SOURCE_FILES.map(code).join('\n');
    ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'Math.random']
      .forEach((term) => expect(combined).not.toContain(term));
  });

  test('node-only require calls are guarded for browser execution', () => {
    SOURCE_FILES.forEach((file) => {
      const source = code(file);
      if (!source.includes('require(')) return;
      expect(source).toMatch(/isNode|typeof module !== 'undefined'/);
    });
  });

  test('no asset asserts a fault, verdict, or specification conclusion', () => {
    const combined = SOURCE_FILES.map(code).join('\n');
    expect(combined).not.toMatch(/\b(faulty|defective|in-spec|out-of-spec|pass|fail|abnormal)\b/i);
  });

  test('no real diagnostic trouble code is hardcoded in the assets', () => {
    SOURCE_FILES.forEach((file) => {
      expect(code(file)).not.toMatch(/\b[PBCU]\d{4}\b/);
    });
  });

  test('the showcase page loads only local asset scripts and has no inline logic', () => {
    const html = read('index.html');
    const scriptTags = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
    expect(scriptTags.length).toBeGreaterThan(0);
    scriptTags.forEach((tag) => {
      expect(tag).toMatch(/<script src="\.\/(src|data)\/[a-z-]+\.js"><\/script>/);
      expect(tag.replace(/<script[^>]*><\/script>/, '').trim()).toBe('');
    });
    expect(html).toMatch(/href="\.\/lab-assets\.css"/);
    expect(html).toMatch(/SIMULATED, DEVELOPMENTAL ASSETS/);
    expect(html).toMatch(/invented illustrative demonstration input/);
  });

  test('the demo payload is explicitly labelled as illustrative and not a measurement', () => {
    const demo = read('data/demo-scenario.js');
    expect(demo).toMatch(/INVENTED FOR DEMONSTRATION/);
    expect(demo).toMatch(/NOT a[\s\S]{0,20}vehicle measurement/);
    expect(demo).toMatch(/illustrative: true/);
    expect(demo).toMatch(/not a real diagnostic trouble code/);
  });
});

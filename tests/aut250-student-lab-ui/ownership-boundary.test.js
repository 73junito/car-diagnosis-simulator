const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'dashboard', 'student', 'aut250-lab-ui');
const TESTS = path.join(ROOT, 'tests', 'aut250-student-lab-ui');

describe('AUT-250 student lab ownership boundary', () => {
  test('new files stay inside the two approved directories', () => {
    expect(fs.existsSync(UI)).toBe(true);
    expect(fs.existsSync(TESTS)).toBe(true);
    for (const name of fs.readdirSync(UI)) {
      expect(name).toMatch(/^(index\.html|aut250-lab\.(js|css)|aut250-mock-adapter\.js|README\.md|preview\.md|adapter-compatibility\.md|integration-handoff\.md|assets)/);
    }
  });

  test('frontend does not import production engine, scoring, Supabase, or workers', () => {
    const runtimeSources = ['index.html', 'aut250-lab.js', 'aut250-mock-adapter.js']
      .map((name) => fs.readFileSync(path.join(UI, name), 'utf8').toLowerCase()).join('\n');
    for (const banned of ['aut250misfirelab', 'supabase', 'wrangler', 'drizzle', 'migration', 'rls policy', 'assessment score', 'gradebook']) {
      expect(runtimeSources).not.toContain(banned);
    }
    expect(runtimeSources).toContain('simulated');
    const readme = fs.readFileSync(path.join(UI, 'README.md'), 'utf8').toLowerCase();
    expect(readme).toContain('untouched');
  });

  test('frontend stays local and isolated from production assessment endpoints', () => {
    const sources = ['index.html', 'aut250-lab.js', 'aut250-mock-adapter.js']
      .map((name) => fs.readFileSync(path.join(UI, name), 'utf8').toLowerCase()).join('\n');
    for (const banned of ['fetch(', 'xmlhttprequest', 'websocket', 'localstorage', '/api/', 'gradebook', 'require(']) {
      expect(sources).not.toContain(banned);
    }
    expect(sources).toContain('locally');
  });
});

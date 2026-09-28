const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('AUT-250 persistent diagnostic reasoning model', () => {
  const dashboard = read('exam-site/courses/aut-250/index.html');
  const player = read('exam-site/courses/aut-250/module/index.html');

  for (const [name, source] of [['dashboard', dashboard], ['player', player]]) {
    test(`${name} displays the project-authored five-step reasoning model`, () => {
      expect(source).toContain('Project-authored reasoning model');
      expect(source).toContain('Request → Measure → Compare → Correlate → Verify');
      expect(source).toContain('<strong>Request</strong>');
      expect(source).toContain('<strong>Measure</strong>');
      expect(source).toContain('<strong>Compare</strong>');
      expect(source).toContain('<strong>Correlate</strong>');
      expect(source).toContain('<strong>Verify</strong>');
      expect((source.match(/diagnostic-reasoning-strip/g) || []).length).toBeGreaterThanOrEqual(1);
    });
  }

  test('model language keeps authoritative comparison and verification boundaries visible', () => {
    expect(player).toContain('Use applicable authoritative information.');
    expect(player).toContain('Confirm the conclusion under relevant conditions.');
  });
});

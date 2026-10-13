const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('production redesign hardening contract', () => {
  test('ships the governed reference library in the app deployment', () => {
    const build = read('scripts/build-static-site.js');
    expect(build).toContain('"reference-library"');
    expect(build).toContain('"reference-library/index.html"');
    expect(build).toContain('"reference-library/library.js"');
  });

  test.each([
    ['dashboard/student/coach/index.html', '/dashboard/student/coach/'],
    ['dashboard/student/activity/index.html', '/dashboard/student/activity/'],
    ['dashboard/student/learning-path/index.html', '/dashboard/student/learning-path/'],
    ['dashboard/student/transcript/index.html', '/dashboard/student/transcript/'],
    ['dashboard/student/copilot/index.html', '/dashboard/student/copilot/']
  ])('%s exposes the canonical student navigation', (file) => {
    const html = read(file);
    for (const href of [
      '/dashboard/student/',
      '/dashboard/student/learning-path/',
      '/dashboard/student/transcript/',
      '/dashboard/student/coach/',
      '/dashboard/student/copilot/',
      '/dashboard/student/activity/',
      '/reference-library/'
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  test('student-facing branding and help copy are normalized', () => {
    expect(read('dashboard/student/coach/index.html')).toContain('Diagnostic Coach');
    expect(read('theme/components/coach-panel/coach-panel.js')).toContain('Diagnostic Coach');
    expect(read('dashboard/student/index.html')).toContain('AutoLearnPro AI Tutor');
    expect(read('dashboard/student/scenario/scenario.js')).toContain('AutoLearnPro AI Tutor');
    expect(read('dashboard/student/scenario/scenario.js')).not.toContain('ðŸ§');
    expect(read('public-site/help/index.html')).toContain("platform's public explanation");
  });

  test('public governance pages expose retention and evidence boundaries', () => {
    const privacy = read('public-site/privacy.html');
    const research = read('public-site/research-sources/index.html');
    expect(privacy).toContain('30-day logical retention boundary');
    expect(privacy).toContain('30 calendar days');
    expect(research).toContain('How research becomes governed evidence');
    expect(research).toContain('instructional approval does not automatically');
  });
});

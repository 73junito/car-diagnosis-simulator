const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
}

describe('responsive viewport hardening contract', () => {
  test('Reference Library filter toolbar can shrink within narrow viewports', () => {
    const css = read('theme/components/filter-toolbar/filter-toolbar.css');
    expect(css).toContain('.tm-filter-toolbar > *');
    expect(css).toContain('min-width:0');
    expect(css).toContain('max-width:100%');
  });

  test('hero status badges are bounded and wrap instead of forcing page overflow', () => {
    const css = read('theme/components/hero-banner/hero-banner.css');
    expect(css).toContain('.tm-hero-banner__status');
    expect(css).toContain('max-width:100%');
    expect(css).toContain('white-space:normal');
    expect(css).toContain('overflow-wrap:anywhere');
  });

  test('Instructor Analytics uses a dedicated horizontal table scroll container', () => {
    const html = read('dashboard/instructor/analytics.html');
    expect(html).toContain('class="tm-table-scroll"');
    expect(html).toContain('aria-label="Student performance table"');
    expect(html).toContain('id="student-table"');
  });

  test('Session History reflows controls and contains its table on narrow screens', () => {
    const html = read('dashboard/instructor/session-history.html');
    const css = read('theme/dashboard.css');
    expect(html).toContain('class="tm-panel tm-session-history-controls"');
    expect(html).toContain('class="tm-session-history-export"');
    expect(html).toContain('aria-label="Session history table"');
    expect(css).toContain('.tm-session-history-controls');
    expect(css).toContain('.tm-session-history-export');
    expect(css).toContain('.tm-table-scroll');
    expect(css).toContain('overflow-x: auto');
  });
});

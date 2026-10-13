const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

describe('CTA analytics navigation contract', () => {
  test('does not navigate to the nonexistent generic dashboard route', () => {
    const source = fs.readFileSync(path.join(root, 'js', 'cta-analytics.js'), 'utf8');

    expect(source).not.toContain("window.location.href = '/dashboard'");
    expect(source).toContain("window.location.href = '/dashboard/instructor/'");
  });
});

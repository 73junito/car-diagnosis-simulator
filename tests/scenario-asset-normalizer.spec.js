/* eslint-env jest */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('scenario asset normalizer', () => {
  test('normalizer runs and report matches registry length', () => {
    const cwd = process.cwd();
    // run normalizer
    execSync('node scripts/normalize-scenario-assets.js', { stdio: 'inherit' });
    const reportPath = path.join(cwd, 'scripts', 'normalized-assets-report.json');
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report).toBeDefined();
    const total = report.total;
    const sum = (report.normalized || 0) + (report.placeholderUsed || 0) + (report.missing || 0);
    expect(sum).toBe(total);
    // ensure all mapped files now exist in assets dir
    report.mappings.forEach(m => {
      const p = path.join(cwd, 'assets', 'images', 'scenarios', m.file);
      expect(fs.existsSync(p)).toBe(true);
    });
  }, 30000);
});

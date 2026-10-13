const fs = require('fs');
const path = require('path');
const { patterns, isExcluded } = require('../scripts/verify-prohibited-trademark-policy');

describe('protected trademark policy guard', () => {
  test('detects the retired mark and taxonomy identifiers without false positives', () => {
    const mark = ['A','S','E'].join('');
    expect(patterns.some((p) => p.regex.test(mark + ' Area'))).toBe(true);
    expect(patterns.some((p) => p.regex.test(mark.toLowerCase() + '_area'))).toBe(true);
    expect(patterns.some((p) => p.regex.test('Supabase'))).toBe(false);
    expect(patterns.some((p) => p.regex.test('database'))).toBe(false);
    expect(patterns.some((p) => p.regex.test('case'))).toBe(false);
    expect(patterns.some((p) => p.regex.test('release'))).toBe(false);
  });

  test('historical migrations and generated index snapshots are explicitly excluded', () => {
    expect(isExcluded('supabase/migrations/20260101000000_history.sql')).toBe(true);
    expect(isExcluded('db/migrations/20260101000000_history.sql')).toBe(true);
    expect(isExcluded('.ai/index.json')).toBe(true);
    expect(isExcluded('dashboard/student/index.html')).toBe(false);
  });

  test('guard script itself does not contain the protected mark as a literal token', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'verify-prohibited-trademark-policy.js'),
      'utf8'
    );
    const mark = ['A','S','E'].join('');
    expect(source).not.toMatch(new RegExp('(^|[^A-Za-z0-9])' + mark + '([^A-Za-z0-9]|$)', 'i'));
  });
});

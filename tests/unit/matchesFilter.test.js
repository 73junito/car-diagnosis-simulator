/**
 * @jest-environment jsdom
 */

const matchesFilter = (s, filters) => {
  if(!s) return false;
  if(filters.category && filters.category !== 'all'){
    if(String((s.category||'')).toLowerCase() !== String(filters.category).toLowerCase()) return false;
  }
  if(filters.difficulty && filters.difficulty !== 'all'){
    if(String((s.difficulty||'')).toLowerCase() !== String(filters.difficulty).toLowerCase()) return false;
  }
  if(filters.diagnostic && filters.diagnostic !== 'all'){
    if(String((s.diagnosticArea||'')).toLowerCase() !== String(filters.diagnostic).toLowerCase()) return false;
  }
  if(filters.q && filters.q.trim() !== ''){
    const q = filters.q.trim().toLowerCase();
    const hay = ((s.title||'') + ' ' + (s.shortSymptom||'') + ' ' + (s.id||'')).toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
};

describe('matchesFilter pure function', () => {
  const base = {
    id: 'no-crank',
    title: 'Engine will not crank',
    shortSymptom: 'Clicking sound when key is turned',
    category: 'no-crank',
    difficulty: 'intermediate',
    diagnosticArea: 'Engine Performance'
  };

  test('empty filters return true', () => {
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'all', diagnostic: 'all' })).toBe(true);
  });

  test('search term matches title', () => {
    expect(matchesFilter(base, { q: 'engine', category: 'all', difficulty: 'all', diagnostic: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: 'clicking', category: 'all', difficulty: 'all', diagnostic: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: 'no-such-term', category: 'all', difficulty: 'all', diagnostic: 'all' })).toBe(false);
  });

  test('category filtering works', () => {
    expect(matchesFilter(base, { q: '', category: 'no-crank', difficulty: 'all', diagnostic: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: '', category: 'other', difficulty: 'all', diagnostic: 'all' })).toBe(false);
  });

  test('difficulty filtering works', () => {
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'intermediate', diagnostic: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'advanced', diagnostic: 'all' })).toBe(false);
  });

  test('diagnostic filtering works', () => {
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'all', diagnostic: 'Engine Performance' })).toBe(true);
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'all', diagnostic: 'Engine Repair' })).toBe(false);
  });

  test('combined filters use logical AND', () => {
    expect(matchesFilter(base, { q: 'engine', category: 'no-crank', difficulty: 'intermediate', diagnostic: 'Engine Performance' })).toBe(true);
    expect(matchesFilter(base, { q: 'engine', category: 'no-crank', difficulty: 'advanced', diagnostic: 'Engine Performance' })).toBe(false);
  });

  test('unknown filter values behave correctly (no match)', () => {
    expect(matchesFilter(base, { q: '', category: 'unknown-cat', difficulty: 'all', diagnostic: 'all' })).toBe(false);
  });
});

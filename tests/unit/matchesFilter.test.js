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
  if(filters.ase && filters.ase !== 'all'){
    if(String((s.aseArea||'')).toLowerCase() !== String(filters.ase).toLowerCase()) return false;
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
    aseArea: 'A8'
  };

  test('empty filters return true', () => {
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'all', ase: 'all' })).toBe(true);
  });

  test('search term matches title', () => {
    expect(matchesFilter(base, { q: 'engine', category: 'all', difficulty: 'all', ase: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: 'clicking', category: 'all', difficulty: 'all', ase: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: 'no-such-term', category: 'all', difficulty: 'all', ase: 'all' })).toBe(false);
  });

  test('category filtering works', () => {
    expect(matchesFilter(base, { q: '', category: 'no-crank', difficulty: 'all', ase: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: '', category: 'other', difficulty: 'all', ase: 'all' })).toBe(false);
  });

  test('difficulty filtering works', () => {
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'intermediate', ase: 'all' })).toBe(true);
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'advanced', ase: 'all' })).toBe(false);
  });

  test('ASE filtering works', () => {
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'all', ase: 'A8' })).toBe(true);
    expect(matchesFilter(base, { q: '', category: 'all', difficulty: 'all', ase: 'A1' })).toBe(false);
  });

  test('combined filters use logical AND', () => {
    expect(matchesFilter(base, { q: 'engine', category: 'no-crank', difficulty: 'intermediate', ase: 'A8' })).toBe(true);
    expect(matchesFilter(base, { q: 'engine', category: 'no-crank', difficulty: 'advanced', ase: 'A8' })).toBe(false);
  });

  test('unknown filter values behave correctly (no match)', () => {
    expect(matchesFilter(base, { q: '', category: 'unknown-cat', difficulty: 'all', ase: 'all' })).toBe(false);
  });
});

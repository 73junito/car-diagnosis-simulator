'use strict'

const fs = require('fs')
const path = require('path')

describe('Phase 7F-M AUT-120 canonical curriculum migration', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261010174000_add_aut120_canonical_curriculum.sql'), 'utf8')

  test('creates identity-preserving AUT-120 course, competency, lesson, and sequence', () => {
    expect(migration).toContain("'aut-120','automotive-technology','undergraduate','47.0604','Automotive Electrical Systems I','planned'")
    expect(migration).toContain("'ug-aut120-electrical-fundamentals','aut-120','undergraduate'")
    expect(migration).toContain("'ug-aut120-electrical-fundamentals','aut-120','ug-aut120-electrical-fundamentals','undergraduate'")
    expect(migration).toContain("'ug-aut120-electrical-fundamentals',8,'Diagnose a generalized electrical concern using evidence'")
  })

  test('maps only already-governed reference sources without changing their rights', () => {
    expect(migration).toContain("'fiore-ac-electrical-circuit-analysis-2021','ug-aut120-electrical-fundamentals','electrical-theory-reference'")
    expect(migration).toContain("'bosch-alternator-technical-poster-2020','ug-aut120-electrical-fundamentals','automotive-electrical-domain-reference'")
    expect(migration).not.toContain('insert into public.curriculum_reference_sources')
  })
})

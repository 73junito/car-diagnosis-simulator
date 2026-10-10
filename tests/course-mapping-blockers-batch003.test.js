const { parsePrereqIds, verify } = require('../scripts/verify-course-mapping-blockers-batch003.js')

describe('Phase 7F-E mapping blockers with Phase 7F-Q canonical resolutions', () => {
  test('parses AUT prerequisite references', () => {
    expect(parsePrereqIds('AUT 130')).toEqual(['aut-130'])
    expect(parsePrereqIds('Concurrent enrollment in AUT 200')).toEqual(['aut-200'])
  })

  test('records the expanded canonical mapping set', () => {
    expect(verify().summary).toEqual({
      canonicalMappings: 59,
      unmappedCatalogCourses: 9,
      priorityBlockers: [],
      batch3: ['aut-200','aut-201','aut-220']
    })
  })

  test('validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

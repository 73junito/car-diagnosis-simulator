const { parsePrereqIds, verify } = require('../scripts/verify-course-mapping-blockers-batch003.js')

describe('Phase 7F-E mapping blockers with Phase 7F-M AUT-120 resolution', () => {
  test('parses AUT prerequisite references', () => {
    expect(parsePrereqIds('AUT 130')).toEqual(['aut-130'])
    expect(parsePrereqIds('Concurrent enrollment in AUT 200')).toEqual(['aut-200'])
  })

  test('records AUT-120 resolved while preserving the remaining blocker set', () => {
    const result = verify()
    expect(result.summary).toEqual({
      canonicalMappings: 55,
      unmappedCatalogCourses: 13,
      priorityBlockers: ['aut-150'],
      batch3: ['aut-200', 'aut-201', 'aut-220']
    })
  })

  test('validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

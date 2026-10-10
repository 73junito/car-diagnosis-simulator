const { parsePrereqIds, verify } = require('../scripts/verify-course-mapping-blockers-batch003.js')

describe('Phase 7F-E mapping blockers and Batch 003 plan', () => {
  test('parses AUT prerequisite references', () => {
    expect(parsePrereqIds('AUT 130')).toEqual(['aut-130'])
    expect(parsePrereqIds('Concurrent enrollment in AUT 200')).toEqual(['aut-200'])
  })

  test('locks blocker counts and Batch 003', () => {
    const result = verify()
    expect(result.summary).toEqual({
      canonicalMappings: 54,
      unmappedCatalogCourses: 14,
      priorityBlockers: ['aut-120', 'aut-150'],
      batch3: ['aut-200', 'aut-201', 'aut-220']
    })
  })

  test('validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

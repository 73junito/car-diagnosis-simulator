const { BATCH, verify } = require('../scripts/verify-batch002-course-pages.js')

describe('Phase 7F-D Batch 002 course pages', () => {
  test('locks the Batch 002 course set', () => {
    expect(BATCH).toEqual(['aut-130', 'aut-131', 'aut-160', 'aut-180'])
  })

  test('all Batch 002 pages satisfy the governed delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

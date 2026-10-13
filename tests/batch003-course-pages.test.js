const { BATCH, verify } = require('../scripts/verify-batch003-course-pages.js')

describe('Phase 7F-F Batch 003 course pages', () => {
  test('locks the Batch 003 course set', () => {
    expect(BATCH).toEqual(['aut-200', 'aut-201', 'aut-220'])
  })

  test('all Batch 003 pages satisfy the governed delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

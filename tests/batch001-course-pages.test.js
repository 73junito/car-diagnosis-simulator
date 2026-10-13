const { BATCH, verify } = require('../scripts/verify-batch001-course-pages.js')

describe('Phase 7F-C Batch 001 course pages', () => {
  test('locks the Batch 001 course set', () => {
    expect(BATCH).toEqual(['aut-101', 'aut-105', 'aut-110', 'aut-115'])
  })

  test('all Batch 001 pages satisfy the governed delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

const { BATCH, verify } = require('../scripts/verify-batch004-graduate-pages.js')

describe('Phase 7F-H Batch 004 graduate pages', () => {
  test('locks the Batch 004 graduate course set', () => {
    expect(BATCH).toEqual(['aut-501', 'aut-515', 'aut-590'])
  })

  test('all Batch 004 pages satisfy the graduate delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

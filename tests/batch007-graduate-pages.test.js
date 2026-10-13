const { BATCH, verify } = require('../scripts/verify-batch007-graduate-pages.js')

describe('Phase 7F-K Batch 007 graduate pages', () => {
  test('locks the Batch 007 graduate course set', () => {
    expect(BATCH).toEqual(['aut-545','aut-565','aut-575'])
  })

  test('all Batch 007 pages satisfy the graduate delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

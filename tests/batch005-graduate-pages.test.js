const { BATCH, verify } = require('../scripts/verify-batch005-graduate-pages.js')

describe('Phase 7F-I Batch 005 graduate pages', () => {
  test('locks the Batch 005 graduate course set', () => {
    expect(BATCH).toEqual(['aut-520', 'aut-530', 'aut-550'])
  })

  test('all Batch 005 pages satisfy the graduate delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

const { BATCH, verify } = require('../scripts/verify-batch006-graduate-pages.js')

describe('Phase 7F-J Batch 006 graduate pages', () => {
  test('locks the Batch 006 graduate course set', () => {
    expect(BATCH).toEqual(['aut-535','aut-540','aut-555','aut-560','aut-570','aut-580','aut-585'])
  })

  test('all Batch 006 pages satisfy the graduate delivery contract', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

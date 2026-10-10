const { EXPECTED, verify } = require('../scripts/verify-batch004-graduate-plan.js')

describe('Phase 7F-G Batch 004 graduate foundation plan', () => {
  test('locks the graduate foundation batch', () => {
    expect(EXPECTED).toEqual(['aut-501', 'aut-515', 'aut-590'])
  })

  test('preserves institutional prerequisite boundaries and blockers', () => {
    expect(verify().summary).toEqual({
      batch4: ['aut-501', 'aut-515', 'aut-590'],
      deferredUndergraduate: ['aut-420'],
      continuingBlockers: ['aut-150']
    })
  })

  test('validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

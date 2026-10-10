const { audit, EXPECTED_SHA, REQUIRED_SCRIPTS } = require('../scripts/verify-production-release-baseline.js')

describe('production release baseline', () => {
  test('certifies the approved merged main SHA', () => {
    expect(EXPECTED_SHA).toBe('9715aa014df2861531866895e3d81ce73585b22e2')
  })

  test('requires all seven release gate command hooks', () => {
    expect(Object.keys(REQUIRED_SCRIPTS)).toHaveLength(7)
  })

  test('baseline contract passes', () => {
    expect(audit()).toMatchObject({
      ok: true,
      errors: []
    })
  })
})

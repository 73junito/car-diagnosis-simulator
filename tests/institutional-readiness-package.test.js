const {
  REQUIRED_EVIDENCE,
  REQUIRED_BOUNDARY_PHRASES,
  verify
} = require('../scripts/verify-institutional-readiness-package.js')

describe('Phase 7B institutional readiness package', () => {
  test('indexes the required reviewer evidence set', () => {
    expect(REQUIRED_EVIDENCE.length).toBeGreaterThanOrEqual(10)
  })

  test('locks the key readiness boundary statements', () => {
    expect(REQUIRED_BOUNDARY_PHRASES).toContain('Assessment authorization: Not granted')
    expect(REQUIRED_BOUNDARY_PHRASES).toContain('64/64 quantitative curriculum-reference coverage')
  })

  test('package validator passes', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: []
    })
  })
})

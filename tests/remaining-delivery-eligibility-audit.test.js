const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit', () => {
  test('classifies all 41 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 0,
        blockedMissingCanonicalMapping: 14,
        blockedPrerequisiteChain: 26,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('does not claim a Batch 008 candidate before a blocker is resolved', () => {
    expect(verify().conclusion).toMatchObject({
      batch008Ready: false,
      batch008Candidates: []
    })
  })
})

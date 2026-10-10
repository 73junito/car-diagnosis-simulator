const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-P Batch 010', () => {
  test('classifies all 36 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 0,
        blockedMissingCanonicalMapping: 13,
        blockedPrerequisiteChain: 22,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('keeps Batch 011 closed until a blocker is resolved', () => {
    expect(verify().conclusion).toMatchObject({
      batch011Ready: false,
      batch011Candidates: []
    })
  })
})

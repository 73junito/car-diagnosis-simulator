const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-S Batch 012', () => {
  test('classifies all 29 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 2,
        blockedMissingCanonicalMapping: 9,
        blockedPrerequisiteChain: 17,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('identifies the exact Batch 013 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch013Ready: true,
      batch013Candidates: ['aut-251','aut-280']
    })
  })
})

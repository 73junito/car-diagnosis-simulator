const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-T Batch 013', () => {
  test('classifies all 27 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 4,
        blockedMissingCanonicalMapping: 9,
        blockedPrerequisiteChain: 13,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('identifies the exact Batch 014 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch014Ready: true,
      batch014Candidates: ['aut-300','aut-310','aut-320','aut-330']
    })
  })
})

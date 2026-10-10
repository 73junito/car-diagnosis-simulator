const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-V Batch 015', () => {
  test('classifies all 16 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 3,
        blockedMissingCanonicalMapping: 9,
        blockedPrerequisiteChain: 2,
        blockedHumanInstitutionalVerification: 2
      }
    })
  })

  test('identifies the exact Batch 016 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch016Ready: true,
      batch016Candidates: ['aut-380','aut-390','aut-410']
    })
  })
})

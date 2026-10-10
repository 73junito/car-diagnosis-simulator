const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-R Batch 011', () => {
  test('classifies all 33 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 4,
        blockedMissingCanonicalMapping: 9,
        blockedPrerequisiteChain: 19,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('identifies the exact Batch 012 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch012Ready: true,
      batch012Candidates: ['aut-211','aut-250','aut-260','aut-270']
    })
  })
})

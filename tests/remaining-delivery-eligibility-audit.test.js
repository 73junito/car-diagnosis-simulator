const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-M AUT-120 resolution', () => {
  test('classifies all 41 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 1,
        blockedMissingCanonicalMapping: 13,
        blockedPrerequisiteChain: 26,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('identifies AUT-120 as the sole evidence-supported Batch 008 candidate', () => {
    expect(verify().conclusion).toMatchObject({
      batch008Ready: true,
      batch008Candidates: ['aut-120']
    })
  })
})

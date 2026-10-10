const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-N Batch 008', () => {
  test('classifies all 40 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 2,
        blockedMissingCanonicalMapping: 13,
        blockedPrerequisiteChain: 24,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('identifies AUT-121 and AUT-170 as the evidence-supported Batch 009 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch009Ready: true,
      batch009Candidates: ['aut-121', 'aut-170']
    })
  })
})

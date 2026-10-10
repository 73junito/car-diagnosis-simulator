const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-O Batch 009', () => {
  test('classifies all 38 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 2,
        blockedMissingCanonicalMapping: 13,
        blockedPrerequisiteChain: 22,
        blockedHumanInstitutionalVerification: 1
      }
    })
  })

  test('identifies AUT-230 and AUT-240 as the evidence-supported Batch 010 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch010Ready: true,
      batch010Candidates: ['aut-230', 'aut-240']
    })
  })
})

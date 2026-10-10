const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')

describe('Phase 7F-L remaining delivery eligibility audit after Phase 7F-U Batch 014', () => {
  test('classifies all 23 remaining catalog courses deterministically', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: [],
      summary: {
        readyToBuildNow: 7,
        blockedMissingCanonicalMapping: 9,
        blockedPrerequisiteChain: 5,
        blockedHumanInstitutionalVerification: 2
      }
    })
  })

  test('identifies the exact Batch 015 candidates', () => {
    expect(verify().conclusion).toMatchObject({
      batch015Ready: true,
      batch015Candidates: ['aut-301','aut-321','aut-331','aut-340','aut-350','aut-360','aut-370']
    })
  })
})

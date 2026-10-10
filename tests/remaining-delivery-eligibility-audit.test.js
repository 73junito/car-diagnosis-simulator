const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')
describe('Phase 7F-X post-resolution delivery eligibility audit',()=>{
  test('classifies all 13 remaining catalog courses',()=>expect(verify()).toMatchObject({ok:true,errors:[],summary:{readyToBuildNow:3,blockedMissingCanonicalMapping:0,blockedPrerequisiteChain:5,blockedHumanInstitutionalVerification:5}}))
  test('identifies exact Batch 017 candidates',()=>expect(verify().conclusion).toMatchObject({batch017Ready:true,batch017Candidates:['aut-140','aut-510','aut-600']}))
})

const { verify } = require('../scripts/verify-remaining-delivery-eligibility-audit.js')
describe('Phase 7F-L audit after Phase 7F-Q canonical resolutions',()=>{
 test('classifies all 36 remaining catalog courses',()=>expect(verify()).toMatchObject({ok:true,errors:[],summary:{readyToBuildNow:3,blockedMissingCanonicalMapping:9,blockedPrerequisiteChain:23,blockedHumanInstitutionalVerification:1}}))
 test('identifies the exact Batch 011 candidates',()=>expect(verify().conclusion).toMatchObject({batch011Ready:true,batch011Candidates:['aut-150','aut-210','aut-525']}))
})

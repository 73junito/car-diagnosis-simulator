const {verify}=require('../scripts/verify-final-eight-governance-review.js')
describe('Phase 7F-ZA final-eight governance review',()=>{
 test('locks the exact final governance state',()=>expect(verify()).toMatchObject({ok:true,errors:[],summary:{remainingCatalogCourses:8,automaticDeliveryEligible:0,coursesWithHumanInstitutionalBlockers:7,coursesWithPrerequisiteChainBlockers:2,coursesWithMultipleBlockerTypes:1,canonicalMappingBlocked:0},conclusion:{batch019Ready:false,batch019Candidates:[]}}))
})

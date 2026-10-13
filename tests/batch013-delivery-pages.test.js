const {verify}=require('../scripts/verify-batch013-delivery-pages.js')
describe('Phase 7F-T Batch 013 delivery pages',()=>{
  test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-251','aut-280']}))
})

const {verify}=require('../scripts/verify-batch015-delivery-pages.js')
describe('Phase 7F-V Batch 015 delivery pages',()=>{
  test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-301','aut-321','aut-331','aut-340','aut-350','aut-360','aut-370']}))
})

const {verify}=require('../scripts/verify-batch014-delivery-pages.js')
describe('Phase 7F-U Batch 014 delivery pages',()=>{
  test('passes the governed delivery and AUT-330 legacy-route separation contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-300','aut-310','aut-320','aut-330']}))
})

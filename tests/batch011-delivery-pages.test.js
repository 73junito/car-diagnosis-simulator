const {verify}=require('../scripts/verify-batch011-delivery-pages.js')
describe('Phase 7F-R Batch 011 delivery pages',()=>{
  test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-150','aut-210','aut-525']}))
})

const {verify}=require('../scripts/verify-batch009-undergraduate-pages.js')
describe('Phase 7F-O Batch 009 undergraduate pages',()=>{
  test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-121','aut-170']}))
})

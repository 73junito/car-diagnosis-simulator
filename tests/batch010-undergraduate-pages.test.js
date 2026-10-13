const {verify}=require('../scripts/verify-batch010-undergraduate-pages.js')
describe('Phase 7F-P Batch 010 undergraduate pages',()=>{
  test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-230','aut-240']}))
})

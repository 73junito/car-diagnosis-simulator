const {verify}=require('../scripts/verify-batch008-undergraduate-page.js')
describe('Phase 7F-N Batch 008 AUT-120 page',()=>{
 test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-120']}))
})

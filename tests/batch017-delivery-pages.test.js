const {verify}=require('../scripts/verify-batch017-delivery-pages.js')
describe('Phase 7F-Y Batch 017 delivery pages',()=>{test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-140','aut-510','aut-600']}))})

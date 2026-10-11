const {verify}=require('../scripts/verify-batch018-delivery-pages.js')
describe('Phase 7F-Z Batch 018 delivery pages',()=>{test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-610','aut-650']}))})

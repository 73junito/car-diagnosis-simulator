const {verify}=require('../scripts/verify-batch016-delivery-pages.js')
describe('Phase 7F-W Batch 016 delivery pages',()=>{test('passes the governed delivery contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-380','aut-390','aut-410']}))})

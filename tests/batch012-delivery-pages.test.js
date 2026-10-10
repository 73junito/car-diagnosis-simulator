const {verify}=require('../scripts/verify-batch012-delivery-pages.js')
describe('Phase 7F-S Batch 012 delivery pages',()=>{
  test('passes the governed delivery and AUT-250 route-collision contract',()=>expect(verify()).toMatchObject({ok:true,errors:[],batch:['aut-211','aut-250','aut-260','aut-270'],routes:{'aut-250':'/courses/aut-250-diagnostics/'}}))
})

const {verify}=require('../scripts/verify-institutional-decision-package.js')
describe('Phase 7F-ZB institutional decision package',()=>{test('defaults all eight decisions to pending and preserves closed delivery',()=>expect(verify()).toMatchObject({ok:true,errors:[],decisionCount:8,status:'prepared-for-external-human-review'}))})

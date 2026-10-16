const {safeName,classify}=require('../scripts/reconcile-cloudflare-previews');
const own='73junito/car-diagnosis-simulator';
const pr=(n,ref,state='closed',full_name=own)=>({number:n,state,head:{ref,repo:{full_name}}});
describe('Cloudflare preview reconciliation guardrails',()=>{
 test('normalizes Wrangler preview name',()=>expect(safeName('feat/test-example')).toBe('feat-test-example'));
 test('never deletes unknown preview',()=>expect(classify({name:'mystery'},[]).action).toBe('retain'));
 test('never deletes active PR preview',()=>expect(classify({name:'feat-one'},[pr(1,'feat/one','open')]).reason).toBe('active_pr'));
 test('never deletes fork-owned preview',()=>expect(classify({name:'feat-one'},[pr(1,'feat/one','closed','some/fork')]).action).toBe('retain'));
 test('never deletes name collision',()=>expect(classify({name:'feat-one'},[pr(1,'feat/one'),pr(2,'feat-one')]).reason).toBe('ambiguous_reused_branch'));
 test('closed owned PR can be reviewed as candidate',()=>expect(classify({name:'feat-one'},[pr(1,'feat/one')])).toEqual({action:'candidate',reason:'verified_closed_pr',pr:1}));
});

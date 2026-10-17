const {classify,reconcile}=require('../scripts/preview-pr-ownership');
const row={branch:'feat-one',builds_preview_id:'a'.repeat(32),identity:'verified',live_status:'present_by_name_lookup'};
const pr={number:123,state:'closed',merged_at:'2026-09-01T00:00:00Z',head:{ref:'feat-one',repo:{full_name:'73junito/car-diagnosis-simulator'}}};
const manifest={readOnly:true,complete:true,scanned:1,buildsTotal:1,rows:[row]};
test('verified preview and same-repo merged PR remain review-only',()=>{expect(classify(row,[pr])).toMatchObject({pr_state:'merged',decision:'cleanup_review_only',deletion_authorized:false})});
test('open PR and ambiguous branch matches are retained',()=>{expect(classify(row,[{...pr,state:'open',merged_at:null}]).decision).toBe('retain_active_pr');expect(classify(row,[pr,pr]).ownership).toBe('ambiguous_branch')});
test('missing ID proof, foreign repo and missing PR are not eligible',()=>{expect(classify({...row,identity:'unverified'},[pr]).decision).toBe('retain_identity_unverified');expect(classify(row,[{...pr,head:{...pr.head,repo:{full_name:'elsewhere/repo'}}}]).decision).toBe('retain_pending_review');expect(classify(row,[]).ownership).toBe('unmatched_branch')});
test('incomplete and duplicate-ID manifests fail closed',()=>{expect(()=>reconcile({...manifest,complete:false},[pr])).toThrow();expect(()=>reconcile({...manifest,scanned:2,buildsTotal:2,rows:[row,row]},[pr])).toThrow()});
test('complete report never authorizes deletion',()=>{const r=reconcile(manifest,[pr]);expect(r).toMatchObject({scanned:1,deletion_authorized:false,counts:{cleanup_review_only:1}})});

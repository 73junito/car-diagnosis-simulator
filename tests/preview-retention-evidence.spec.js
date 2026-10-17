const {assess}=require('../scripts/assess-preview-retention-evidence');
const o={read_only:true,deletion_authorized:false,worker:'autolearnpro-app',scanned:1,rows:[{branch:'feat-a',builds_preview_id:'id1',live_status:'present_by_name_lookup',identity:'verified',pr_number:1,pr_state:'merged',ownership:'verified_live_preview_id_plus_pr_branch_context',decision:'cleanup_review_only'}]};
const e={readOnly:true,complete:true,worker:'autolearnpro-app',scanned:1,rows:[{branch:'feat-a',builds_preview_id:'id1',live_status:'present_by_name_lookup',identity:'verified',eligibility:'retained',reason:'within_30_day_retention'}]};
test('identity-matched recent merged PR remains retained',()=>expect(assess(o,e)).toMatchObject({counts:{retain_30_day_window:1},deletion_authorized:false}));
test('aged candidate still requires storage and binding evidence',()=>{const r=assess(o,{...e,rows:[{...e.rows[0],eligibility:'review_required'}]});expect(r.rows[0]).toMatchObject({decision:'dependency_evidence_required',binding_dependency:'not_verified',storage_dependency:'not_verified',deletion_authorized:false})});
test('mismatched identities fail closed',()=>expect(()=>assess(o,{...e,rows:[{...e.rows[0],builds_preview_id:'DIFFERENT'}]})).toThrow('Manifest identity mismatch'));
test('incomplete manifest fails closed',()=>expect(()=>assess(o,{...e,complete:false})).toThrow());

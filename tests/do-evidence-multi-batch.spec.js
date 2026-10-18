const {run}=require('../scripts/collect-do-evidence-batches');
const name='autolearnpro-app_feat-old_TorqueMindRateLimitCounter';
const id='a'.repeat(32);
const inv={inventory:{pagination:{complete:true,verification:'declared_total_count_exact'},total_namespaces:1,namespaces:[{id,name,script:'autolearnpro-app'}]}};
const dep={read_only:true,deletion_authorized:false,rows:[{namespace_id:id,name,script:'autolearnpro-app',preview_match:'no_preview_identity_join',object_evidence_status:'not_collected'}]};
const live={read_only:true,deletion_authorized:false,summary:{workers:6},rows:[]};
const observation={name,object_enumeration_complete:true,object_count:0,has_stored_data:false};
test('accepts prior raw expanded evidence, skips already complete IDs',async()=>{const result=await run({inventory:inv,dependencies:dep,bindings:live,previous:[{read_only:true,deletion_authorized:false,entries:[observation],failures:[]}],account:'b'.repeat(32),token:'x',fetchImpl:()=>{throw Error('should not call network')}});expect(result).toMatchObject({attempted:0,prior_complete:1,deletion_authorized:false})});
test('rejects deletion-authorized evidence',async()=>{await expect(run({inventory:inv,dependencies:dep,bindings:live,previous:[{read_only:true,deletion_authorized:true,entries:[observation],failures:[]}],account:'b'.repeat(32),token:'x'})).rejects.toThrow('Untrusted prior evidence')});

const {correlate,parseCsv}=require('../scripts/correlate-do-usage-evidence');
const n=(id,name,script='autolearnpro-app')=>({id,name,script});
const inv={inventory:{pagination:{complete:true},total_namespaces:2,namespaces:[n('1','autolearnpro-app_TorqueMindRateLimitCounter'),n('2','autolearnpro-app_feat-x_TorqueMindRateLimitCounter')]}};
const ob={namespaces:[{name:'autolearnpro-app_TorqueMindRateLimitCounter',object_enumeration_complete:true,object_count:1,has_stored_data:true}],failures:[{name:'autolearnpro-app_feat-x_TorqueMindRateLimitCounter',reason:'HTTP 404'}]};
test('unknown analytics is never zero and failed object inspection stays unknown',()=>{
 const result=correlate(inv,[{namespace_id:'1',status:'measured',requests_30d:'20'},{namespace_id:'2',status:'unknown_no_group',requests_30d:''}],ob);
 expect(result.summary).toMatchObject({total:2,measured_requests:1,unknown_requests:1,object_evidence_failed:1,protected:1,deletion_authorized:0});
 expect(result.rows[1]).toMatchObject({requests_30d:null,object_evidence_status:'failed',has_stored_data:null,assessment:'insufficient_evidence',deletion_authorized:false});
});
test('rejects inventory and duplicate analytics records',()=>{
 expect(()=>correlate({inventory:{...inv.inventory,pagination:{complete:false}}},[],ob)).toThrow();
 expect(()=>correlate(inv,[{namespace_id:'1',status:'measured'},{namespace_id:'1',status:'measured'}],ob)).toThrow();
});
test('CSV quoted fields parse',()=>expect(parseCsv('namespace_id,namespace_name,status\n"1","hello, world","measured"')[0].namespace_name).toBe('hello, world'));

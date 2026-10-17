const {summarize,collect}=require('../scripts/collect-live-worker-metadata');
test('only allowlisted non-secret values survive',()=>{
 const r=summarize('autolearnpro-app',{bindings:[{name:'SECRET',type:'secret_text',text:'DO_NOT_EXPOSE'},{name:'SEMANTIC_SCHOLAR_ENABLED',type:'plain_text',text:'true'},{name:'TORQUEMIND_RATE_LIMITER',type:'durable_object_namespace',namespace_id:'private'},{name:'SEMANTIC_SCHOLAR_API_KEY',type:'secrets_store_secret',secret_name:'private'}]});
 expect(JSON.stringify(r)).not.toContain('DO_NOT_EXPOSE');expect(JSON.stringify(r)).not.toContain('private');
 expect(r).toMatchObject({flags:{SEMANTIC_SCHOLAR_ENABLED:'true'},routes_status:'unverified',secrets_store_binding_names:['SEMANTIC_SCHOLAR_API_KEY']});
});
test('GET only, failed Worker unknown not silently successful',async()=>{
 const fetchImpl=async(_url,args)=>{expect(args.method).toBe('GET');return {ok:false,status:403}};
 const result=await collect({account:'a'.repeat(32),token:'fake',names:['autolearnpro-app'],fetchImpl});
 expect(result).toMatchObject({completed:0,failed:1,deletion_authorized:false});expect(result.errors[0].reason).toBe('HTTP 403');
});
test('reject missing binding evidence',()=>expect(()=>summarize('x',{})).toThrow());

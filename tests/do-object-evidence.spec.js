const {collect, parseObjectsPage, inspectNamespace, assertInventory} = require('../scripts/collect-do-object-evidence');
const ns={id:'0'.repeat(31)+'1',name:'autolearnpro-app_feat-example_TorqueMindRateLimitCounter',script:'autolearnpro-app'};
const inventory={namespaces:[ns],total_namespaces:1,pagination:{complete:true,verification:'declared_total_count_exact'}};
const page=(items,cursor)=>({success:true,result:items,result_info:{cursor:cursor||null}});
const response=x=>({ok:true,json:async()=>x});
test('missing / malformed inventory fails closed',()=>{
  expect(()=>assertInventory({namespaces:[ns],total_namespaces:1,pagination:{complete:false}})).toThrow();
  expect(()=>assertInventory({...inventory,namespaces:[ns,ns],total_namespaces:2})).toThrow();
});
test('pagination enumerates all objects and never invents bytes/traffic',async()=>{
  let calls=0; const fetchImpl=async(url,options)=>{
    expect(options.method).toBe('GET'); calls++;
    return response(calls===1?page([{id:'a',hasStoredData:false}],'next'):page([{id:'b',hasStoredData:true}],null));
  };
  const r=await inspectNamespace({account:'a'.repeat(32),token:'fake',namespace:ns,fetchImpl});
  expect(r).toMatchObject({has_stored_data:true,object_count:2,objects_with_stored_data:1,pages:2,storage_bytes:null,requests:null,active_preview:null,object_enumeration_complete:true});
});
test('empty fully enumerated namespace shows no objects but not 0 bytes',async()=>{
  const r=await inspectNamespace({account:'a'.repeat(32),token:'fake',namespace:ns,fetchImpl:async()=>response(page([],null))});
  expect(r.has_stored_data).toBe(false); expect(r.storage_bytes).toBeNull();
});
test('malformed object, repeated cursor, duplicate id all fail',async()=>{
  expect(()=>parseObjectsPage(page([{id:'x'}],null))).toThrow();
  await expect(inspectNamespace({account:'a'.repeat(32),token:'fake',namespace:ns,fetchImpl:async()=>response(page([],'same'))})).rejects.toThrow(/Repeated/);
  await expect(inspectNamespace({account:'a'.repeat(32),token:'fake',namespace:ns,fetchImpl:async()=>response(page([{id:'duplicate',hasStoredData:false}],'next'))})).rejects.toThrow(/Duplicate/);
});
test('per-namespace errors remain explicit and never authorize deletion',async()=>{
  const result=await collect({inventory,account:'a'.repeat(32),token:'fake',maxNamespaces:1,fetchImpl:async()=>({ok:false,status:403})});
  expect(result.namespaces_failed).toBe(1);
  expect(result.namespaces).toEqual([]);
  expect(result.deletion_authorized).toBe(false);
});

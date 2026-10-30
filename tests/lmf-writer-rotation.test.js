const test=require('node:test');
const assert=require('node:assert/strict');
const {createEvidenceStore}=require('../src/lmf-runtime/evidence-store');
const {createEvidenceKeyring}=require('../src/lmf-runtime/evidence-keyring');
const actor='123e4567-e89b-42d3-a456-426614174000';
const sessionId='123e4567-e89b-42d3-a456-426614174003';
const request={modelRef:'/data/circuit-templates/12v-starting-system-v2.json'};
const keys={v1:Buffer.alloc(32,1),v2:Buffer.alloc(32,2)};
test('writer persists versioned evidence and verifies chain through rotation',async()=>{
 const events=[];
 const db={query:async(sql,params)=>{
  if(sql.includes('left join lateral'))return {rows:[{sequence_number:events.length||null,event_hash:events.at(-1)?.hash||null}]};
  const envelope={body:JSON.parse(params[4]),hash:params[5],signature:params[6]};
  events.push(envelope);return {rows:[{id:'event-'+events.length}]};
 }};
 const deps={db,verifyAccessToken:async()=>({verified:true,userId:actor}),computeEvidence:async req=>({evidenceRole:'training-reference-only',request:req,outcome:{status:'solver-refused'}}),signingKeys:keys};
 await createEvidenceStore({...deps,activeKeyId:'v1'}).append({token:'valid',sessionId,request});
 await createEvidenceStore({...deps,activeKeyId:'v2'}).append({token:'valid',sessionId,request});
 assert.equal(events[0].body.record.signingKeyId,'v1');
 assert.equal(events[1].body.record.signingKeyId,'v2');
 const ring=createEvidenceKeyring({activeKeyId:'v2',keys});
 assert.equal(ring.verify({...events[0],keyId:'v1'},{actor}),true);
 assert.equal(ring.verify({...events[1],keyId:'v2'},{actor,previousHash:events[0].hash}),true);
 assert.equal(ring.verify({...events[1],keyId:'v1'},{actor,previousHash:events[0].hash}),false);
});

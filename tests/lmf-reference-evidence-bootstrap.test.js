"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createReferenceEvidenceService}=require("../src/lmf-runtime/reference-evidence-bootstrap");
const model=require("../data/circuit-templates/12v-starting-system-v2.json");
const owner="123e4567-e89b-42d3-a456-426614174000",sessionId="123e4567-e89b-42d3-a456-426614174003";
const req={modelRef:"/data/circuit-templates/12v-starting-system-v2.json",operatingStateId:"crank",testPointId:"TP_BAT_POS"};
const res=()=>({setHeader(){},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}});
const http=request=>({method:"POST",headers:{authorization:"Bearer validated-token"},body:{sessionId,request}});
test("bootstrap verifies token, computes server evidence and submits to private append",async()=>{
 const sql=[];
 const service=createReferenceEvidenceService({model,signingKey:Buffer.alloc(32,3),
  authClient:{auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}},error:null})}},
  db:{query:async(q,args)=>{sql.push({q,args});return sql.length===1?{rows:[{sequence_number:null,event_hash:null}]}:{rows:[{id:"new-event"}]}}},
  computeReferenceEvidence:async(_,request)=>({schemaVersion:"1.0.0",evidenceRole:"training-reference-only",request,outcome:{status:"solver-refused",measurement:null}})});
 const reply=res();await service.handler(http(req),reply);
 assert.equal(reply.statusCode,201);assert.equal(sql.length,2);
 assert.ok(sql[1].q.includes("lmf_private.append_reference_event"));
});
test("bootstrap rejects modified engineering parameters before any requests",()=>{
 const changed=structuredClone(model);changed.templateVersion="99";
 assert.throws(()=>createReferenceEvidenceService({model:changed,signingKey:Buffer.alloc(32),authClient:{auth:{getUser:async()=>{}}},db:{query:async()=>{}},computeReferenceEvidence:async()=>{}}),/Unapproved or mutated/);
});
test("bootstrap refuses forged solver outcome without database write",async()=>{
 let writes=0;
 const service=createReferenceEvidenceService({model,signingKey:Buffer.alloc(32,4),
  authClient:{auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}},error:null})}},
  db:{query:async()=>{writes++;return {rows:[]}}},
  computeReferenceEvidence:async(_,request)=>({evidenceRole:"training-reference-only",request,outcome:{status:"solved",measurement:{provenance:{modelSha256:"bad",modelRef:req.modelRef}}}})});
 const reply=res();await service.handler(http(req),reply);
 assert.equal(reply.statusCode,400);assert.equal(writes,0);
});

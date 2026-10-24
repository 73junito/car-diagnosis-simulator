"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createReferenceEvidenceHandler}=require("../src/lmf-runtime/reference-evidence-handler");
function response(){return {code:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(body){this.body=body;return this}}}
const valid={method:"POST",headers:{authorization:"Bearer fake-token"},body:{sessionId:"abc",request:{modelRef:"/data/circuit-templates/12v-starting-system-v2.json",operatingStateId:"crank",testPointId:"TP_BAT_POS"}}};
test("route refuses non-POST and missing token without executing store",async()=>{
 let called=false;const handler=createReferenceEvidenceHandler({store:{append:async()=>{called=true}}});
 const a=response();await handler({...valid,method:"GET"},a);assert.equal(a.code,405);
 const b=response();await handler({...valid,headers:{}},b);assert.equal(b.code,401);
 assert.equal(called,false);
});
test("route rejects caller supplied measurement and extra fields",async()=>{
 let called=false;const handler=createReferenceEvidenceHandler({store:{append:async()=>{called=true}}});
 const r=response();await handler({...valid,body:{...valid.body,measurement:{value:99}}},r);
 assert.equal(r.code,400);assert.equal(called,false);
});
test("route sends bearer token only to trusted store and returns evidence metadata",async()=>{
 let args;const handler=createReferenceEvidenceHandler({store:{append:async input=>{args=input;return {eventId:"id",sequenceNumber:1,eventHash:"a".repeat(64)}}}});
 const r=response();await handler(valid,r);
 assert.equal(r.code,201);assert.equal(args.token,"fake-token");assert.equal(r.body.eventHash,"a".repeat(64));
 assert.equal(r.headers["Cache-Control"],"no-store");
});
test("route refuses failed authentication and concurrent append conflict",async()=>{
 for(const [message,expected] of [["Verified actor required",401],["Stale or broken reference evidence chain",409]]){
  const handler=createReferenceEvidenceHandler({store:{append:async()=>{throw Error(message)}}});
  const r=response();await handler(valid,r);assert.equal(r.code,expected);
 }
});

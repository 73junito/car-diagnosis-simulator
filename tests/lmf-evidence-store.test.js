'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEvidenceStore}=require('../src/lmf-runtime/evidence-store');
const actor='123e4567-e89b-42d3-a456-426614174000';
const sessionId='123e4567-e89b-42d3-a456-426614174002';
const request={modelRef:'/data/circuit-templates/12v-starting-system-v2.json',operatingStateId:'crank',testPointId:'TP_BAT_POS'};
const computed={evidenceRole:'training-reference-only',request,outcome:{status:'solver-refused',measurement:null}};
test('requires verified identity before work',async()=>{
 let called=false;
 const store=createEvidenceStore({db:{query:async()=>{called=true;return {rows:[]}}},verifyAccessToken:async()=>({verified:false,userId:actor}),computeEvidence:async()=>{called=true;return computed},key:Buffer.alloc(32)});
 await assert.rejects(store.append({token:'invalid',sessionId,request}),/Verified actor/);
 assert.equal(called,false);
});
test('calls trusted compute and private append with owner sequence',async()=>{
 const calls=[];
 const db={query:async(sql,params)=>{calls.push({sql,params});return calls.length===1?{rows:[{sequence_number:4,event_hash:'a'.repeat(64)}]}:{rows:[{id:'event-id'}]}}};
 const store=createEvidenceStore({db,verifyAccessToken:async()=>({verified:true,userId:actor}),computeEvidence:async()=>computed,key:Buffer.alloc(32,7)});
 const result=await store.append({token:'valid',sessionId,request});
 assert.equal(result.sequenceNumber,5);
 assert.equal(calls[1].params[1],actor);
 assert.equal(calls[1].params[2],5);
 assert.match(calls[1].sql,/lmf_private\.append_reference_event/);
});

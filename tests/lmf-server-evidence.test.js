"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const model=require("../data/circuit-templates/12v-starting-system-v2.json");
const {verifyModel,signEnvelope,verifyEnvelope}=require("../src/lmf-runtime/server-evidence");
const actor="123e4567-e89b-42d3-a456-426614174000",other="123e4567-e89b-42d3-a456-426614174001";
const key=crypto.randomBytes(32);
const record={schemaVersion:"1.0.0",evidenceRole:"training-reference-only",request:{operatingStateId:"crank"},outcome:{status:"solver-refused",measurement:null}};
test("pinned model digest detects changed parameter or version",()=>{
 assert.match(verifyModel(model),/^[a-f0-9]{64}$/);
 const changed=structuredClone(model);
 changed.templateVersion="2.0.1";
 assert.throws(()=>verifyModel(changed),/Unapproved or mutated/);
});
test("authenticated signed evidence rejects forged value, wrong owner, or broken chain",()=>{
 const first=signEnvelope({actor,record,key});
 assert.equal(verifyEnvelope(first,{actor,key}),true);
 assert.equal(verifyEnvelope(first,{actor:other,key}),false);
 const changed=structuredClone(first);changed.body.record.outcome.status="solved";
 assert.equal(verifyEnvelope(changed,{actor,key}),false);
 const second=signEnvelope({actor,record,key,previousHash:first.hash});
 assert.equal(verifyEnvelope(second,{actor,key,previousHash:first.hash}),true);
 assert.equal(verifyEnvelope(second,{actor,key,previousHash:"a".repeat(64)}),false);
});
test("rejects missing authenticated actor and insecure signing key",()=>{
 assert.throws(()=>signEnvelope({actor:"anonymous",record,key}),/actor UUID/);
 assert.throws(()=>signEnvelope({actor,record,key:Buffer.alloc(8)}),/32 bytes/);
});

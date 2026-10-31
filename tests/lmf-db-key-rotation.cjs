"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {Client}=require("pg");
const {createEvidenceStore}=require("../src/lmf-runtime/evidence-store");
const {createEvidenceKeyring}=require("../src/lmf-runtime/evidence-keyring");
const user="123e4567-e89b-42d3-a456-426614174000";
const session="123e4567-e89b-42d3-a456-426614174003";
const modelRef="/data/circuit-templates/12v-starting-system-v2.json";
const request={modelRef,operatingStateId:"crank",testPointId:"TP_BAT_POS"};
const keys={v1:crypto.randomBytes(32),v2:crypto.randomBytes(32)};
async function main(){
 const url=process.env.LMF_TEST_DATABASE_URL;
 // Same disposable-target guard as tests/lmf-db-concurrency.cjs: a database name alone does not
 // prove the target is throwaway, so the host is constrained to loopback as well. Rejected URLs
 // throw before any Client is constructed, so no connection is attempted.
 if(!url)throw Error("Local disposable LMF database required");
 let parsed;
 try{parsed=new URL(url)}catch{throw Error("Local disposable LMF database required")}
 if(!["postgres:","postgresql:"].includes(parsed.protocol)||
    parsed.pathname!=="/lmf_rotation_verify"||
    !["localhost","127.0.0.1","::1","[::1]"].includes(parsed.hostname))
   throw Error("Local disposable LMF database required");
 const db=new Client({connectionString:url});
 await db.connect();
 try{
  await db.query("insert into auth.users(id) values($1)",[user]);
  await db.query("insert into public.lmf_reference_sessions(id,owner_id,model_ref,model_sha256,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",[session,user,modelRef,"a".repeat(64)]);
  const base={db,verifyAccessToken:async()=>({verified:true,userId:user}),computeEvidence:async req=>({schemaVersion:"1.0.0",evidenceRole:"training-reference-only",request:req,outcome:{status:"solver-refused"}}),signingKeys:keys};
  await createEvidenceStore({...base,activeKeyId:"v1"}).append({token:"local-test",sessionId:session,request});
  await createEvidenceStore({...base,activeKeyId:"v2"}).append({token:"local-test",sessionId:session,request});
  const saved=await db.query("select sequence_number,previous_hash,event_hash,event_signature,payload from public.lmf_reference_events where session_id=$1 order by sequence_number",[session]);
  assert.equal(saved.rows.length,2);
  const ring=createEvidenceKeyring({activeKeyId:"v2",keys});
  let previousHash=null;
  for(const [index,row] of saved.rows.entries()){
   assert.equal(Number(row.sequence_number),index+1);
   assert.equal(row.previous_hash,previousHash);
   const keyId=row.payload.record.signingKeyId;
   assert.equal(keyId,index===0?"v1":"v2");
   assert.equal(ring.verify({body:row.payload,hash:row.event_hash,signature:row.event_signature,keyId},{actor:user,previousHash}),true);
   previousHash=row.event_hash;
  }
  const wrongKeyRing=createEvidenceKeyring({activeKeyId:"v2",keys:{v2:keys.v2}});
  assert.equal(wrongKeyRing.verify({body:saved.rows[0].payload,hash:saved.rows[0].event_hash,signature:saved.rows[0].event_signature,keyId:"v1"},{actor:user}),false);
  console.log("PASS: PostgreSQL persisted v1 and v2 signatures, key rotation, verified chain and retired-key denial");
 }finally{await db.end();}
}
main().catch(err=>{console.error("Rotation integration failed:",err.message);process.exitCode=1});

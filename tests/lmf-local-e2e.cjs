"use strict";
/** Run only on a disposable local DB with LMF_TEST_DATABASE_URL set. */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const {Client}=require("pg");
const {createClient}=require("@supabase/supabase-js");
const esbuild=require("esbuild");
const Module=require("node:module");
const model=require("../data/circuit-templates/12v-starting-system-v2.json");
const {verifyEnvelope}=require("../src/lmf-runtime/server-evidence");
const {createReferenceEvidenceService}=require("../src/lmf-runtime/reference-evidence-bootstrap");
const ORIGINAL=Module._extensions[".ts"];
Module._extensions[".ts"]=function(mod,filename){
 const js=esbuild.transformSync(fs.readFileSync(filename,"utf8"),{loader:"ts",format:"cjs",target:"node22"}).code;
 mod._compile(js,filename);
};
const {captureReferenceEvidence}=require("../src/simulation/lmf-reference-evidence.ts");
const {replayReferenceEvidence}=require("../src/simulation/lmf-reference-evidence.ts");
Module._extensions[".ts"]=ORIGINAL;
const REF="/data/circuit-templates/12v-starting-system-v2.json";
const request={modelRef:REF,operatingStateId:"crank",testPointId:"TP_BAT_POS"};
async function run(){
 const url=process.env.LMF_TEST_DATABASE_URL;
 const authUrl=process.env.LMF_LOCAL_SUPABASE_URL;
 const anon=process.env.LMF_LOCAL_SUPABASE_ANON_KEY;
 const adminKey=process.env.LMF_LOCAL_SUPABASE_SERVICE_KEY;
 if(!url?.includes("lmf_e2e_verify")||!authUrl?.startsWith("http://127.0.0.1:54321")||!anon||!adminKey)throw Error("Local isolated environment only");
 const authClient=createClient(authUrl,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(authUrl,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const password=crypto.randomBytes(24).toString("base64url")+"Ab9!";
 const email="lmf-e2e-"+crypto.randomUUID()+"@example.invalid";
 let userId=null;
 const db=new Client({connectionString:url});
 const key=crypto.randomBytes(32);
 try{
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(created.error)throw created.error;
  userId=created.data.user.id;
  const login=await authClient.auth.signInWithPassword({email,password});
  if(login.error)throw login.error;
  const token=login.data.session.access_token;
  const direct=await authClient.auth.getUser(token);
  assert.equal(direct.data.user.id,userId);
  await db.connect();
  await db.query("insert into auth.users(id) values($1)",[userId]);
  const sessionId=crypto.randomUUID();
  await db.query("insert into public.lmf_reference_sessions(id,owner_id,model_ref,model_sha256,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",[sessionId,userId,REF,crypto.createHash("sha256").update(JSON.stringify(model)).digest("hex")]);
  const service=createReferenceEvidenceService({model,signingKey:key,db,authClient,computeReferenceEvidence:captureReferenceEvidence});
  const call=async authorization=>{
   const response={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
   await service.handler({method:"POST",headers:{authorization},body:{sessionId,request}},response);
   return response;
  };
  const noAuth=await call(undefined);
  assert.equal(noAuth.code,401);
  const bad=await call("Bearer invalid-token");
  assert.equal(bad.code,401);
  const good=await call("Bearer "+token);
  assert.equal(good.code,201);
  const event=await db.query("select * from public.lmf_reference_events where session_id=$1",[sessionId]);
  assert.equal(event.rows.length,1);
  const saved=event.rows[0];
  assert.equal(saved.owner_id,userId);
  assert.equal(saved.sequence_number,"1");
  const envelope={body:saved.payload,hash:saved.event_hash,signature:saved.event_signature};
  assert.equal(verifyEnvelope(envelope,{actor:userId,key}),true,'persisted HMAC mismatch');
  const replay=replayReferenceEvidence(model,saved.payload.record);
  assert.equal(replay.matches,true,'replay serialized key-order mismatch');
  assert.equal(saved.payload.record.outcome.status,"solved");
  console.log("PASS: real local Supabase Auth login, denied invalid tokens, MNA simulation, signed persistent event, HMAC verification, deterministic replay");
 } finally {
  await db.end().catch(()=>{});
  if(userId){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error)console.error("Local test user cleanup failed:",removed.error.message)}
 }
}
run().catch(e=>{console.error("LMF E2E FAILED:",e.message);process.exitCode=1});

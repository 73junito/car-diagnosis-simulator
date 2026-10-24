"use strict";
// Isolated PostgreSQL concurrency verification. Requires LMF_TEST_DATABASE_URL
// and a disposable database already initialized with the two draft migrations.
const assert=require("node:assert/strict");
const {Client}=require("pg");
const session="123e4567-e89b-42d3-a456-426614174003";
const owner="123e4567-e89b-42d3-a456-426614174001";
const payload=JSON.stringify({evidenceRole:"training-reference-only"});
async function main(){
 const url=process.env.LMF_TEST_DATABASE_URL;
 if(!url)throw Error("Disposable LMF database required");
 const parsed=new URL(url);
 if(!["postgres:","postgresql:"].includes(parsed.protocol)||
    parsed.pathname!=="/lmf_concurrency_verify"||
    !["localhost","127.0.0.1","::1","[::1]"].includes(parsed.hostname))
   throw Error("Local disposable LMF database required");
 const clients=await Promise.all([0,1,2].map(async()=>{const c=new Client({connectionString:url});await c.connect();return c}));
 const append=(c,sequence,previous,hash)=>c.query(
 "select lmf_private.append_reference_event($1,$2,$3,$4,$5::jsonb,$6,$7) as id",
 [session,owner,sequence,previous,payload,hash,"f".repeat(64)]);
 try{
  const race=await Promise.allSettled([append(clients[0],1,null,"a".repeat(64)),append(clients[1],1,null,"b".repeat(64))]);
  assert.equal(race.filter(x=>x.status==="fulfilled").length,1,"exactly one concurrent first append succeeds");
  assert.equal(race.filter(x=>x.status==="rejected").length,1,"one conflicting append is rejected");
  const head=await clients[2].query("select sequence_number,event_hash from public.lmf_reference_events where session_id=$1 order by sequence_number",[session]);
  assert.equal(head.rows.length,1);
  const next=await append(clients[2],2,head.rows[0].event_hash,"c".repeat(64));
  assert.equal(next.rowCount,1);
  const count=await clients[2].query("select count(*)::int n from public.lmf_reference_events where session_id=$1",[session]);
  assert.equal(count.rows[0].n,2);
  console.log("PASS: two parallel first appends -> one accepted, one rejected; correct chain continuation.");
 } finally {await Promise.all(clients.map(c=>c.end()));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

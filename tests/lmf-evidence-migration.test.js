"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const sql=fs.readFileSync(path.resolve(__dirname,"../supabase/migrations/20261024212822_lmf_reference_evidence_access.sql"),"utf8");
test("both LMF tables enable RLS and only declare owner-scoped SELECT",()=>{
 for(const table of ["lmf_reference_sessions","lmf_reference_events"]){
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security","i"));
  assert.match(sql,new RegExp("revoke all on public\\."+table+" from anon,authenticated","i"));
  assert.match(sql,new RegExp("grant select on public\\."+table+" to authenticated","i"));
  assert.doesNotMatch(sql,new RegExp("grant (?:insert|update|delete|all) on public\\."+table+" to authenticated","i"));
 }
 assert.match(sql,/owner_id\s*=\s*\(select auth\.uid\(\)\)/i);
 assert.doesNotMatch(sql,/security definer/i);
});
test("evidence schema requires ownership-bound session and constrained event chain metadata",()=>{
 assert.match(sql,/foreign key\s*\(session_id,owner_id\)\s*references\s+public\.lmf_reference_sessions\(id,owner_id\)/i);
 assert.match(sql,/unique\s*\(session_id,sequence_number\)/i);
 assert.match(sql,/expires_at\s*>\s*created_at/i);
 assert.match(sql,/training-reference-only/i);
});

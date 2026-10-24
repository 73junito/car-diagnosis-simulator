"use strict";
// Server-only adapter. verifyAccessToken MUST verify an authenticated JWT, never simply decode it.
// computeEvidence must build the outcome from an approved, digest-verified server-side model.
const {createEvidenceKeyring}=require("./evidence-keyring");
const MODEL_REF="/data/circuit-templates/12v-starting-system-v2.json";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function createEvidenceStore({db,verifyAccessToken,computeEvidence,key,signingKeys,activeKeyId}){
 if(typeof db?.query!=="function"||typeof verifyAccessToken!=="function"||typeof computeEvidence!=="function")throw Error("Trusted database, authentication and compute providers required");
 const keyring=createEvidenceKeyring({activeKeyId:activeKeyId||'legacy-v1',keys:signingKeys||{'legacy-v1':key}});
 return Object.freeze({
  async append({token,sessionId,request}){
   if(typeof token!=="string"||!token)throw Error("Missing access token");
   const principal=await verifyAccessToken(token);
   if(!principal||principal.verified!==true||typeof principal.userId!=="string"||!UUID.test(principal.userId))throw Error("Verified actor required");
   const actor=principal.userId;
   if(typeof sessionId!=="string"||!UUID.test(sessionId))throw Error("Invalid session ID");
   if(!request||request.modelRef!==MODEL_REF)throw Error("Unsupported model request");
   // No caller-provided results. computeEvidence must verify the model content before solving.
   const record=await computeEvidence(Object.freeze({...request}));
   if(record?.evidenceRole!=="training-reference-only"||record?.request?.modelRef!==MODEL_REF)throw Error("Untrusted reference evidence");
   const read=await db.query("select s.owner_id,s.expires_at,e.sequence_number,e.event_hash from public.lmf_reference_sessions s left join lateral (select sequence_number,event_hash from public.lmf_reference_events where session_id=s.id order by sequence_number desc limit 1) e on true where s.id=$1 and s.owner_id=$2 and s.expires_at>now()",[sessionId,actor]);
   if(read.rows.length!==1)throw Error("Session unavailable");
   const head=read.rows[0],next=Number(head.sequence_number??0)+1,previous=head.event_hash??null;
   if(!Number.isSafeInteger(next)||next<1)throw Error("Invalid evidence sequence");
   const envelope=keyring.sign({actor,record,previousHash:previous});
   const response=await db.query("select lmf_private.append_reference_event($1,$2,$3,$4,$5::jsonb,$6,$7) as id",
      [sessionId,actor,next,previous,JSON.stringify(envelope.body),envelope.hash,envelope.signature]);
   return Object.freeze({eventId:response.rows[0].id,sequenceNumber:next,eventHash:envelope.hash});
  }
 });
}
module.exports={createEvidenceStore};

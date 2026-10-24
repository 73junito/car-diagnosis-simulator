"use strict";
// Transport-only handler. No demo fallback and no browser-side secret access.
// Dependencies must come from a trusted server bootstrap.
function createReferenceEvidenceHandler({store}){
 if(!store||typeof store.append!=="function")throw Error("Server evidence store required");
 return async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"method_not_allowed"});
  const header=req.headers?.authorization;
  const match=typeof header==="string"&&/^Bearer ([^\s]+)$/i.exec(header);
  if(!match)return res.status(401).json({ok:false,error:"authentication_required"});
  const body=req.body;
  if(!body||typeof body!=="object"||Array.isArray(body)||!body.sessionId||!body.request||
     Object.keys(body).some(k=>!["sessionId","request"].includes(k)))
    return res.status(400).json({ok:false,error:"invalid_request"});
  const request=body.request;
  if(typeof request!=="object"||Array.isArray(request)||
     Object.keys(request).some(k=>!["modelRef","operatingStateId","testPointId","faultId"].includes(k)))
    return res.status(400).json({ok:false,error:"invalid_request"});
  try{
   const result=await store.append({token:match[1],sessionId:body.sessionId,request});
   return res.status(201).json({ok:true,eventId:result.eventId,sequenceNumber:result.sequenceNumber,eventHash:result.eventHash});
  }catch(e){
   const message=String(e?.message||"");
   if(/Verified actor|Unverified|token|identity/i.test(message))return res.status(401).json({ok:false,error:"authentication_failed"});
   if(/Session unavailable|owner mismatch|expired/i.test(message))return res.status(404).json({ok:false,error:"session_unavailable"});
   if(/Stale or broken/i.test(message))return res.status(409).json({ok:false,error:"conflict"});
   if(/Unsupported model|Invalid|Untrusted/i.test(message))return res.status(400).json({ok:false,error:"invalid_request"});
   return res.status(503).json({ok:false,error:"evidence_unavailable"});
  }
 };
}
module.exports={createReferenceEvidenceHandler};

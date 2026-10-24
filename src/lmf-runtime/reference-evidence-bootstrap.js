"use strict";
// Server-only composition. Never instantiate in a browser or with caller-controlled credentials.
const {verifyModel}=require("./server-evidence");
const {createSupabaseTokenVerifier}=require("./supabase-auth");
const {createEvidenceStore}=require("./evidence-store");
const {createReferenceEvidenceHandler}=require("./reference-evidence-handler");
const REF="/data/circuit-templates/12v-starting-system-v2.json";
function createReferenceEvidenceService({authClient,db,signingKey,signingKeys,activeKeyId,model,computeReferenceEvidence}){
 if(typeof computeReferenceEvidence!=="function")throw Error("Trusted solver required");
 const digest=verifyModel(model);
 const verifyAccessToken=createSupabaseTokenVerifier(authClient);
 const computeEvidence=async request=>{
  if(!request||request.modelRef!==REF)throw Error("Unsupported model request");
  // Verify each invocation, not only bootstrap: fail closed if the model object was mutated.
  if(verifyModel(model)!==digest)throw Error("Reference model changed");
  const safeRequest=Object.freeze({...request});
  const record=await computeReferenceEvidence(model,safeRequest);
  if(!record||record.evidenceRole!=="training-reference-only"||
     JSON.stringify(record.request)!==JSON.stringify(safeRequest)||
     (record.outcome?.status==="solved" &&
      (record.outcome.measurement?.provenance?.modelSha256!==digest||
       record.outcome.measurement?.provenance?.modelRef!==REF)))
    throw Error("Untrusted solver outcome");
  return record;
 };
 const store=createEvidenceStore({db,verifyAccessToken,computeEvidence,key:signingKey,signingKeys,activeKeyId});
 return Object.freeze({handler:createReferenceEvidenceHandler({store})});
}
module.exports={createReferenceEvidenceService};

"use strict";
// Server-only, authenticated and keyed reference evidence envelope. No browser secrets.
const crypto=require("node:crypto");
// Reviewed canonical JSON digest of the current Starting-System v2 model; update only after engineering review.
const PIN="aedda68a5f756da6369ff2cc6e0bddd667cdaa27f8562f0750285f7d75651904";
const equal=(a,b)=>a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
function verifyModel(model){
 if(!model||typeof model!=="object")throw Error("Missing model");
 const digest=crypto.createHash("sha256").update(JSON.stringify(model)).digest("hex");
 if(!equal(digest,PIN))throw Error("Unapproved or mutated engineering model");
 return digest;
}
function requireActor(actor){
 if(typeof actor!=="string"||!/^[-a-f0-9]{36}$/.test(actor))throw Error("Verified authenticated actor UUID required");
 return actor;
}
function signEnvelope({actor,record,key,previousHash=null}){
 requireActor(actor);
 if(!Buffer.isBuffer(key)||key.length<32)throw Error("Server signing key must contain at least 32 bytes");
 if(previousHash!==null&&!/^[a-f0-9]{64}$/.test(previousHash))throw Error("Invalid prior hash");
 if(!record||record.evidenceRole!=="training-reference-only")throw Error("Unapproved evidence");
 const body={schemaVersion:"1.0.0",actor,previousHash,record};
 const canonical=JSON.stringify(body,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
 const hash=crypto.createHash("sha256").update(canonical).digest("hex");
 const signature=crypto.createHmac("sha256",key).update(hash).digest("hex");
 return {body,hash,signature};
}
function verifyEnvelope(envelope,{actor,key,previousHash=null}){
 requireActor(actor);
 if(!Buffer.isBuffer(key)||key.length<32)throw Error("Invalid server signing key");
 if(!envelope||typeof envelope!=="object"||typeof envelope.hash!=="string"||typeof envelope.signature!=="string")return false;
 if(envelope.body?.actor!==actor||envelope.body?.previousHash!==previousHash)return false;
 const check=signEnvelope({actor,record:envelope.body.record,key,previousHash});
 return equal(check.hash,envelope.hash)&&equal(check.signature,envelope.signature);
}
module.exports={verifyModel,signEnvelope,verifyEnvelope};

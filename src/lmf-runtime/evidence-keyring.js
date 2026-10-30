"use strict";
const {signEnvelope,verifyEnvelope}=require("./server-evidence");
const VALID=/^[a-zA-Z0-9_-]{1,64}$/;
function createEvidenceKeyring({activeKeyId,keys}){
 if(typeof activeKeyId!=="string"||!VALID.test(activeKeyId)||!keys||typeof keys!=="object")throw Error("Invalid signing-key configuration");
 const entries=Object.entries(keys);
 if(!entries.length||entries.some(([id,key])=>!VALID.test(id)||!Buffer.isBuffer(key)||key.length<32)||!keys[activeKeyId])throw Error("Invalid signing keyring");
 const snapshot=new Map(entries.map(([id,key])=>[id,Buffer.from(key)]));
 return Object.freeze({
  sign({actor,record,previousHash=null}){
   const signed=signEnvelope({actor,record:{...record,signingKeyId:activeKeyId},previousHash,key:snapshot.get(activeKeyId)});
   return {...signed,keyId:activeKeyId};
  },
  verify(envelope,{actor,previousHash=null}){
   const id=envelope?.keyId;
   if(typeof id!=="string"||!snapshot.has(id)||envelope?.body?.record?.signingKeyId!==id)return false;
   return verifyEnvelope(envelope,{actor,previousHash,key:snapshot.get(id)});
  }
 });
}
module.exports={createEvidenceKeyring};

"use strict";
// Explicit-only privileged cleanup worker; disabled until policy and operator approval.
function createReferenceRetentionJob({db,logger,enabled=false,batchLimit=100}){
 if(typeof db?.query!=="function"||typeof logger?.info!=="function"||typeof logger?.error!=="function")throw Error("Database and structured audit logger required");
 if(!Number.isInteger(batchLimit)||batchLimit<1||batchLimit>1000)throw Error("Invalid retention batch limit");
 return Object.freeze({async run({approved=false}={}){
  if(!enabled||approved!==true)throw Error("Retention policy approval and explicit enablement required");
  const started=new Date().toISOString();
  try{
   const result=await db.query("select lmf_private.purge_expired_reference_sessions($1) as deleted",[batchLimit]);
   const deleted=Number(result.rows?.[0]?.deleted);
   if(!Number.isSafeInteger(deleted)||deleted<0||deleted>batchLimit)throw Error("Invalid retention result");
   logger.info({event:"lmf.reference_retention",status:"completed",deleted,batchLimit,started});
   return Object.freeze({deleted});
  }catch(error){
   logger.error({event:"lmf.reference_retention",status:"failed",started,errorCode:"retention_operation_failed"});
   throw error;
  }
 }});
}
module.exports={createReferenceRetentionJob};

const test=require("node:test"),assert=require("node:assert/strict");
const {createReferenceRetentionJob}=require("../src/lmf-runtime/reference-retention-job");
test("disabled job refuses execution before database access",async()=>{
 let calls=0;
 const job=createReferenceRetentionJob({db:{query:async()=>{calls++}},logger:{info(){},error(){}}});
 await assert.rejects(job.run({approved:true}),/approval and explicit enablement/);
 assert.equal(calls,0);
});
test("enabled job requires approval and records aggregate audit only",async()=>{
 let calls=0;const messages=[];
 const job=createReferenceRetentionJob({db:{query:async(_sql,args)=>{calls++;assert.deepEqual(args,[2]);return {rows:[{deleted:2}]}}},logger:{info:x=>messages.push(x),error:x=>messages.push(x)},enabled:true,batchLimit:2});
 await assert.rejects(job.run(),/approval/);assert.equal(calls,0);
 assert.deepEqual(await job.run({approved:true}),{deleted:2});
 assert.equal(messages[0].event,"lmf.reference_retention");
 assert.equal(messages[0].deleted,2);
 assert.equal(JSON.stringify(messages).includes("userId"),false);
});

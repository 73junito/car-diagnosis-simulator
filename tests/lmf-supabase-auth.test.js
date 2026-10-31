"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createSupabaseTokenVerifier}=require("../src/lmf-runtime/supabase-auth");
const ID="123e4567-e89b-42d3-a456-426614174000";
test("verifies via trusted Supabase Auth getUser(token)",async()=>{
 let passed;
 const check=createSupabaseTokenVerifier({auth:{getUser:async token=>{passed=token;return {data:{user:{id:ID,is_anonymous:false}},error:null}}}});
 assert.deepEqual(await check("valid.jwt"),{verified:true,userId:ID});
 assert.equal(passed,"valid.jwt");
});
test("rejects missing, invalid, and anonymous tokens",async()=>{
 const failed=createSupabaseTokenVerifier({auth:{getUser:async()=>({data:{user:null},error:new Error("invalid")})}});
 await assert.rejects(failed("expired"),/verification failed/);
 await assert.rejects(failed(""),/Missing bearer/);
 const anonymous=createSupabaseTokenVerifier({auth:{getUser:async()=>({data:{user:{id:ID,is_anonymous:true}},error:null})}});
 await assert.rejects(anonymous("token"),/Anonymous identity/);
});
test("refuses fake client that cannot verify user tokens",()=>{
 assert.throws(()=>createSupabaseTokenVerifier({auth:{}}),/getUser required/);
});

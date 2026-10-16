"use strict";
const {test}=require("node:test");const assert=require("node:assert/strict");
const {latestForPr,verdict}=require("../scripts/check-latest-staging-smoke");
const run=(id,status,conclusion,when,pr=994)=>({id,event:"pull_request",status,conclusion,created_at:when,pull_requests:[{number:pr}]});
test("newest run for target PR wins, even when cancelled",()=>{
 const old=run(1,"completed","success","2026-10-15T12:00:00Z");
 const newer=run(2,"completed","cancelled","2026-10-15T12:05:00Z");
 assert.deepEqual(latestForPr([old,newer,run(3,"completed","success","2026-10-15T12:06:00Z",995)],994),newer);
 assert.equal(verdict(newer).ok,false);
});
test("running, absent, and failed runs hold merge",()=>{
 assert.equal(verdict(null).ok,false);
 assert.equal(verdict(run(3,"in_progress",null,"2026-10-15T12:00:00Z")).ok,false);
 assert.equal(verdict(run(4,"completed","failure","2026-10-15T12:00:00Z")).ok,false);
});
test("only a completed successful newest run passes",()=>{
 assert.equal(verdict(run(5,"completed","success","2026-10-15T12:00:00Z")).ok,true);
});

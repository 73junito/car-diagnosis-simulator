"use strict";
const {latestForPr,verdict}=require("../scripts/check-latest-staging-smoke");
const run=(id,status,conclusion,when,pr=994)=>({id,event:"pull_request",status,conclusion,created_at:when,pull_requests:[{number:pr}]});
describe("latest staging smoke result",()=>{
 test("newest run for target PR wins, even when cancelled",()=>{
  const old=run(1,"completed","success","2026-10-15T12:00:00Z");
  const newer=run(2,"completed","cancelled","2026-10-15T12:05:00Z");
  expect(latestForPr([old,newer,run(3,"completed","success","2026-10-15T12:06:00Z",995)],994)).toEqual(newer);
  expect(verdict(newer).ok).toBe(false);
 });
 test("running, absent, and failed runs hold merge",()=>{
  expect(verdict(null).ok).toBe(false);
  expect(verdict(run(3,"in_progress",null,"2026-10-15T12:00:00Z")).ok).toBe(false);
  expect(verdict(run(4,"completed","failure","2026-10-15T12:00:00Z")).ok).toBe(false);
 });
 test("only a completed successful newest run passes",()=>{
  expect(verdict(run(5,"completed","success","2026-10-15T12:00:00Z")).ok).toBe(true);
 });
});

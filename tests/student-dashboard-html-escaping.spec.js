"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.resolve(__dirname,"../dashboard/student/student.js"),"utf8");
const match=src.match(/function escapeDashboardHtml\(value\) \{[\s\S]*?\n\}/);
if(!match)throw Error("HTML escaping helper missing");
const escape=vm.runInNewContext("("+match[0]+")");
describe("student dashboard API HTML boundaries",()=>{
 test("escapes executable HTML and attribute delimiters",()=>{
  expect(escape('<img src=x onerror="alert(1)"> & \'')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;');
 });
 test("escapes every student progress and recommendation interpolated value",()=>{
  for(const field of ["r.scenario_id","r.responses","r.correct_responses","r.accuracy_pct","transcript.scenario_count","transcript.response_count","transcript.correct_response_count","transcript.accuracy_pct","row.scenario_id","row.reason"]){
   expect(src).toContain("${escapeDashboardHtml("+field+")}");
  }
  expect(src).toContain("encodeURIComponent(row.scenario_id)");
 });
});

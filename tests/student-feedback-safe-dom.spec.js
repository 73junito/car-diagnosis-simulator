"use strict";
const fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../dashboard/student/student.js"),"utf8");
describe("Student AI feedback XSS defense",()=>{
 test("response fields use textContent and are never interpolated into HTML",()=>{
   const section=source.slice(source.indexOf("async function loadTorqueMindFeedback("));
   expect(section).toContain("paragraph.textContent = typeof value === \"string\" ? value : \"\"");
   expect(section).toContain("body.replaceChildren(content)");
   expect(section).not.toMatch(/body\.innerHTML\s*=\s*`/);
   expect(section).not.toContain("${data.reasonIncorrect}");
   expect(section).not.toContain("${data.reasonCorrect}");
 });
 test("feedback headings are preserved and remain plain text",()=>{
   for(const heading of ["Why your answer was incorrect","Correct reasoning","Technical Concept","Next Diagnostic Step"])expect(source).toContain(heading);
   expect(source).toContain('title.textContent = heading');
 });
});

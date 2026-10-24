"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validate,IDS,DOMAINS}=require("../scripts/check-lmf-robustness-catalog.cjs");
const catalog=require("../data/lmf/robustness-catalog.json");
test("catalog validates all 18 categories and four domains",()=>{assert.equal(IDS.length,18);assert.equal(DOMAINS.length,4);assert.deepEqual(validate(catalog),[])});
test("omission and duplicates are rejected",()=>{
 assert.ok(validate({...catalog,dimensions:catalog.dimensions.slice(1)}).some(x=>x.includes("Missing dimension")));
 assert.ok(validate({...catalog,dimensions:[...catalog.dimensions,catalog.dimensions[0]]}).some(x=>x.includes("duplicate")));
});
test("an unsubstantiated pass is rejected",()=>{
 const dimensions=catalog.dimensions.map((x,i)=>i===0?{...x,status:"passed"}:x);
 assert.ok(validate({...catalog,dimensions}).some(x=>x.includes("unproven pass")));
});
test("planned features do not count as passes",()=>{assert.ok(catalog.dimensions.every(x=>x.applicability==="planned"&&x.status==="not-evaluated"))});

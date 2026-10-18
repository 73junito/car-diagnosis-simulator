'use strict';const test=globalThis.test || require('node:test');const assert=require('node:assert/strict');
const program=require('../docs/institutional-readiness/dcaf-program-gates.json');const {verify}=require('../scripts/verify-dcaf-program-gates');
const copy=()=>JSON.parse(JSON.stringify(program));
test('baseline is formative and has six guarded stages',()=>assert.equal(verify(copy()).stage_count,6));
test('rejects high-stakes eligibility',()=>{const p=copy();p.high_stakes_eligible=true;assert.throws(()=>verify(p),/unsafe program claims/)});
test('rejects automatic advancement and grading',()=>{const p=copy();p.controls.student_grading_enabled=true;assert.throws(()=>verify(p),/Unsafe/)});
test('requires research ethics and partner agreement',()=>{const p=copy();p.stages.find(s=>s.id==='R3').required_evidence=[];assert.throws(()=>verify(p),/Malformed|ethics/);const q=copy();q.stages.find(s=>s.id==='R4').required_evidence=['instructor_UAT','accessibility_review'];assert.throws(()=>verify(q),/pilot agreement/)});
test('rejects unapproved claims of validated scoring',()=>{const p=copy();p.rubric.status='validated';assert.throws(()=>verify(p),/rubric/)});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createRuntime}=require("../src/lmf-runtime");
test("deterministic charging runtime and pinned provenance",()=>{
 const r=createRuntime("circuit-lab"),s=r.resolveState({operatingStateId:"key-off"});
 assert.deepEqual(s,r.resolveState({operatingStateId:"key-off"}));
 assert.match(s.modelIdentity.sha256,/^[a-f0-9]{64}$/);
 assert.ok(Object.isFrozen(s.resolvedState.operatingState));
 assert.equal(s.provenance.sourceRole,"engineering-model-derived");
});
test("invalid labs and operating states fail closed",()=>{
 assert.throws(()=>createRuntime("engine-mechanical-lab"),/not registered/);
 const r=createRuntime("circuit-lab");
 assert.throws(()=>r.resolveState({operatingStateId:"invalid"}),/Unknown operating state/);
 assert.throws(()=>r.resolveState({operatingStateId:"key-off",faultId:"invalid"}),/Unknown fault/);
});
test("measurement without solver returns no fabricated quantity",()=>{
 const r=createRuntime("circuit-lab");
 const q={operatingStateId:"key-off",toolId:"tool.dmm",testPointId:"TP_BAT_POS",measurementType:"voltage"};
 const result=r.measure(q);
 assert.equal(result.status,"solver-not-connected");
 assert.equal(result.measurement,null);
 assert.throws(()=>r.measure({...q,toolId:"tool.invalid"}),/Tool not authorized/);
 assert.throws(()=>r.measure({...q,testPointId:"invalid"}),/Unknown test point/);
 assert.throws(()=>r.measure({...q,measurementType:"frequency"}),/unsupported/);
});

"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {listSolverCandidates,requestSolver}=require("../src/lmf-runtime/solver-registry");
test("all five candidate solvers declared without executable authority",()=>{
 const solvers=listSolverCandidates();
 assert.deepEqual(solvers.map(s=>s.solverId),["typescript-mna","ngspice","openmodelica","omsimulator","opendss"]);
 assert.ok(solvers.every(s=>s.assessmentAuthority===false));
 assert.ok(Object.isFrozen(solvers[0]));
});
test("candidate solver requests fail closed and never fabricate measurements",()=>{
 for(const item of listSolverCandidates()){const r=requestSolver(item.solverId);assert.equal(r.status,"integration-not-authorized");assert.equal(r.measurement,null);assert.ok(Object.isFrozen(r))}
 assert.throws(()=>requestSolver("unknown-solver"),/Unknown solver/);
});

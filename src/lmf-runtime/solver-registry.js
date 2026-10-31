"use strict";
// Candidate registry is metadata only: never execute binaries or grant solver authority.
const fs=require("node:fs"),path=require("node:path");
const file=path.resolve(__dirname,"../../data/lmf/solver-registry.json");
const frozen=v=>{if(v&&typeof v==="object"){for(const child of Object.values(v))frozen(child);Object.freeze(v)}return v};
function listSolverCandidates(){const data=JSON.parse(fs.readFileSync(file,"utf8"));if(data.registryRole!=="unified-lmf-solver-candidates")throw Error("Solver registry role drift");const ids=new Set();for(const solver of data.solvers){if(!solver.solverId||ids.has(solver.solverId)||solver.assessmentAuthority!==false)throw Error("Invalid solver registry entry");ids.add(solver.solverId)}return frozen(data.solvers)}
function requestSolver(solverId){const candidate=listSolverCandidates().find(x=>x.solverId===solverId);if(!candidate)throw Error("Unknown solver");return frozen({solverId,status:"integration-not-authorized",measurement:null,role:candidate.role,integrationStatus:candidate.integrationStatus,reason:"Solver candidate registration does not confer an executable or validated adapter"})}
module.exports={listSolverCandidates,requestSolver};

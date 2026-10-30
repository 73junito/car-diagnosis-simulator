"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseGlb } = require("./verify-circuit-lab-3d-assets");
const root = path.resolve(__dirname, "..");
const models = [
  "dashboard/student/circuit-lab/assets/3d/multimeter-detailed-review.glb",
  "dashboard/student/starting-system-lab/assets/3d/starter-motor-detailed-review.glb",
  "dashboard/student/starting-system-lab/assets/3d/starter-solenoid-detailed-review.glb"
];
for (const model of models) {
  const {gltf, primitives} = parseGlb(path.join(root,model));
  assert.ok(primitives.length, model+" has no geometry");
  assert.equal(gltf.asset.version,"2.0");
  assert.match(gltf.asset.generator,/presentation-only/);
  assert.ok(gltf.accessors[0].count>50,model+" is unexpectedly empty");
  console.log("[PASS] Review geometry: "+model);
}
const circuit = fs.readFileSync(path.join(root,"dashboard/student/circuit-lab/circuit-lab-3d.js"),"utf8");
const starter = fs.readFileSync(path.join(root,"dashboard/student/starting-system-lab/starting-system-lab-classroom.js"),"utf8");
for (const source of [circuit,starter]) {
  assert.match(source,/get\("visualReview"\)\s*===\s*"1"/);
  assert.match(source,/asset\.url/);
}
assert.match(circuit,/asset\.assetId\s*===\s*"equipment\.dmm"/);
assert.match(starter,/asset\.title\s*===\s*"Generic Starter Motor"/);
assert.match(starter,/asset\.title\s*===\s*"Generic Starter Solenoid"/);
console.log("[PASS] Opt-in review boundary and original asset fallback");

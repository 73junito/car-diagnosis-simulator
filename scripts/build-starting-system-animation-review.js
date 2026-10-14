"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { findBlender } = require("./run-blender-animation-pipeline");
const root = path.resolve(__dirname, "..");
const blender = findBlender();
if (!blender) { console.error("[FAIL] Blender 5.2+ not found. Set BLENDER_EXE."); process.exit(2); }
const p={template:path.join(root,"data","circuit-templates","12v-starting-system.json"),manifest:path.join(root,"animation","manifests","starting-system-voltage-drop-review.json"),script:path.join(root,"animation","blender","scripts","build_starting_system_review.py"),output:path.join(root,"animation","review-assets","starting-system-voltage-drop-review.glb"),metadata:path.join(root,"animation","review-assets","starting-system-voltage-drop-review.metadata.json"),fallback:path.join(root,"animation","review-assets","starting-system-voltage-drop-review.svg")};
for (const f of [p.template,p.manifest,p.script]) if(!fs.existsSync(f)){console.error("[FAIL] Missing ANIM-1D input: "+f);process.exit(2);}
const r=spawnSync(blender,["--background","--factory-startup","--python",p.script,"--","--template",p.template,"--manifest",p.manifest,"--output",p.output,"--metadata",p.metadata,"--fallback",p.fallback],{cwd:root,stdio:"inherit",windowsHide:true});
if(r.error){console.error("[FAIL] Blender execution failed:",r.error.message);process.exit(1);}
if(r.status!==0) process.exit(r.status||1);
for(const f of [p.output,p.metadata,p.fallback]) if(!fs.existsSync(f)){console.error("[FAIL] Missing ANIM-1D output: "+f);process.exit(1);}

"use strict";
const crypto=require("crypto"),fs=require("fs"),path=require("path"),Ajv=require("ajv");
const {validateManifest}=require("./verify-animation-manifests");
const root=path.resolve(__dirname,".."),r=(p)=>path.join(root,p);
const f={template:r("data/circuit-templates/12v-starting-system.json"),manifest:r("animation/manifests/starting-system-voltage-drop-review.json"),glb:r("animation/review-assets/starting-system-voltage-drop-review.glb"),metadata:r("animation/review-assets/starting-system-voltage-drop-review.metadata.json"),fallback:r("animation/review-assets/starting-system-voltage-drop-review.svg")};
const hash=(x)=>crypto.createHash("sha256").update(fs.readFileSync(x)).digest("hex");
const canonicalTextHash=(x)=>crypto.createHash("sha256").update(
  fs.readFileSync(x,"utf8").replace(/\r\n/g,"\n").replace(/\r/g,"\n"),
  "utf8"
).digest("hex");
function glbJson(x){const b=fs.readFileSync(x);if(b.length<20||b.toString("ascii",0,4)!=="glTF")throw new Error("Invalid GLB header");const n=b.readUInt32LE(12);if(b.toString("ascii",16,20)!=="JSON")throw new Error("GLB first chunk is not JSON");return JSON.parse(b.toString("utf8",20,20+n).trim());}
function verify(){const errors=[];for(const x of Object.values(f))if(!fs.existsSync(x))errors.push("missing file: "+path.relative(root,x));if(errors.length)return{errors};
const template=JSON.parse(fs.readFileSync(f.template,"utf8")),manifest=JSON.parse(fs.readFileSync(f.manifest,"utf8")),metadata=JSON.parse(fs.readFileSync(f.metadata,"utf8"));
const schema=JSON.parse(fs.readFileSync(r("schemas/animation-manifest.schema.json"),"utf8"));const validate=new Ajv({allErrors:true,strict:false}).compile(schema);errors.push(...validateManifest(manifest,path.basename(f.manifest),validate,root));
if(template.vehicleApplicability?.vehicleSpecific!==false)errors.push("template must remain generic");
if(manifest.governance?.publicationAllowed!==false||manifest.governance?.vehicleSpecificClaims!==false)errors.push("review manifest governance invalid");
if(metadata.assetStatus!=="engineering-derived-review-only")errors.push("asset status invalid");
if(metadata.publicationAllowed!==false||metadata.assessmentEligible!==false||metadata.scoredAssessmentApproved!==false)errors.push("asset crossed publication/assessment boundary");
if(metadata.agentMayApprove!==false||metadata.agentMayRelease!==false)errors.push("asset crossed agent boundary");
if(metadata.engineeringTemplateSha256!==hash(f.template))errors.push("template hash mismatch");if(metadata.manifestSha256!==canonicalTextHash(f.manifest))errors.push("manifest hash mismatch");if(metadata.outputSha256!==hash(f.glb))errors.push("GLB hash mismatch");if(metadata.fallbackSha256!==canonicalTextHash(f.fallback))errors.push("fallback hash mismatch");if(metadata.outputBytes!==fs.statSync(f.glb).size)errors.push("GLB size mismatch");
const g=glbJson(f.glb),assetIds=new Set((g.nodes||[]).map(n=>n.extras?.animationComponentId).filter(Boolean));for(const c of manifest.components)if(!assetIds.has(c.id))errors.push("GLB missing animation component: "+c.id);
const expected={"battery":"BAT1","control-protection":"FUSE1","start-command-switch":"SW1","starter-solenoid-coil":"SOL_COIL","starter-solenoid-contact":"SOL_CONTACT","starter-motor":"MTR1","ground-path":"GND1"};for(const [a,e] of Object.entries(expected))if(metadata.componentMappings?.[a]!==e)errors.push("mapping mismatch: "+a);
if(!metadata.instructionalOverlays?.includes("digital-multimeter"))errors.push("DMM overlay classification missing");if(metadata.testPointIds?.length!==template.testPoints.length)errors.push("test-point derivation mismatch");if(!String(metadata.numericPolicy||"").includes("No vehicle-specific"))errors.push("numeric policy missing");if(metadata.textHashPolicy!=="sha256-utf8-lf-normalized")errors.push("canonical text hash policy missing");
if(!fs.readFileSync(f.fallback,"utf8").includes("vehicle-specific service information is required"))errors.push("fallback generic notice missing");
const build=fs.readFileSync(r("scripts/build-static-site.js"),"utf8");if(build.includes("animation/review-assets")||build.includes("starting-system-voltage-drop-review.json"))errors.push("review assets must remain outside static deployment");
return{errors,manifest,metadata,gltf:g};}
if(require.main===module){const x=verify();if(x.errors.length){console.error("[FAIL] ANIM-1D review verification failed");for(const e of x.errors)console.error("  - "+e);process.exit(1);}console.log("[PASS] ANIM-1D review asset is engineering-derived, non-published, and mapped to the canonical starting-system template.");}
module.exports={verify,glbJson};

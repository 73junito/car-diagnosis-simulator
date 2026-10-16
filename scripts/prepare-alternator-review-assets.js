"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const output=path.join(root,"animation/cadquery/review/vendor/three");
const lock=require(path.join(root,"package-lock.json"));
const expected=lock.packages?.["node_modules/three"]?.version;
const packageRoot=path.join(root,"node_modules/three");
if(!expected)throw Error("Three.js version is absent from package lock");
const manifest=JSON.parse(fs.readFileSync(path.join(packageRoot,"package.json"),"utf8"));
if(manifest.version!==expected)throw Error("Installed Three.js version does not match lockfile: "+manifest.version+" vs "+expected);
const files=[
 ["build/three.module.js","build/three.module.js"],
 ["build/three.core.js","build/three.core.js"],
 ["examples/jsm/controls/OrbitControls.js","addons/controls/OrbitControls.js"],
 ["examples/jsm/loaders/GLTFLoader.js","addons/loaders/GLTFLoader.js"],
 ["examples/jsm/utils/BufferGeometryUtils.js","addons/utils/BufferGeometryUtils.js"],
 ["examples/jsm/utils/SkeletonUtils.js","addons/utils/SkeletonUtils.js"],
 ["LICENSE","LICENSE"],
];
for(const [src,dst] of files){
 const target=path.join(output,dst);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.copyFileSync(path.join(packageRoot,src),target);
}
console.log("Alternator review assets prepared from installed Three.js "+expected+" (ignored review/vendor/three).");

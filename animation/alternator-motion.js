// Review-only animation controller. No diagnostic, test-point or assessment authority.
function createAlternatorMotion(scene, {reducedMotion=false}={}){
 if(!scene||typeof scene.getObjectByName!=="function")throw new TypeError("GLB scene required");
 const names=["ALT1_pulley","ALT1_rotor_shaft"];
 const parts=names.map(name=>scene.getObjectByName(name));
 if(parts.some(x=>!x))throw new Error("Alternator missing independent pulley/shaft nodes");
 const all=["ALT1_housing_front","ALT1_housing_rear","ALT1_mounting_ear","ALT1_output_stud","ALT1_plug_connector"];
 if(all.some(n=>!scene.getObjectByName(n)))throw new Error("Incomplete seven-part alternator assembly");
 for(const part of parts){
  const data=part.userData||{};
  if(data.animationEligible!==true||data.runtimeDrivenOnly!==true||data.rotationAxis!=="X"||data.engineeringAuthority!==false||data.measurementAuthority!==false||data.publicationAuthority!==false)throw new Error("Invalid motion/governance contract: "+part.name);
  if(Math.abs(part.position.y)>1e-6||Math.abs(part.position.z)>1e-6)throw new Error("Rotation pivot off shaft centerline");
 }
 const initial=parts.map(p=>p.rotation.x);
 let running=false,disposed=false;
 return Object.freeze({
  start(){if(disposed)throw new Error("Motion disposed");running=!reducedMotion;return running},
  pause(){running=false},
  step(deltaSeconds,rpm){
   if(disposed||!running||reducedMotion)return false;
   if(!Number.isFinite(deltaSeconds)||deltaSeconds<0||deltaSeconds>0.1)throw new RangeError("Invalid frame delta");
   if(!Number.isFinite(rpm)||rpm<0||rpm>15000)throw new RangeError("Invalid illustrative RPM");
   const delta=deltaSeconds*rpm*2*Math.PI/60;
   for(const p of parts)p.rotation.x=(p.rotation.x+delta)%(2*Math.PI);
   return true;
  },
  reset(){running=false;parts.forEach((p,i)=>{p.rotation.x=initial[i]})},
  dispose(){running=false;disposed=true},
  get playing(){return running},
  get nodes(){return [...names]}
 });
}

if(typeof module !== 'undefined' && module.exports) module.exports={createAlternatorMotion};
if(typeof window !== 'undefined') window.createAlternatorMotion=createAlternatorMotion;

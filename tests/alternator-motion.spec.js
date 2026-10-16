"use strict";
const fs=require("fs"),path=require("path"),url=require("url");
const create=()=>Promise.resolve(require("../animation/alternator-motion"));
function makeScene(){
 const nodes=["ALT1_pulley","ALT1_rotor_shaft","ALT1_housing_front","ALT1_housing_rear","ALT1_mounting_ear","ALT1_output_stud","ALT1_plug_connector"].map(name=>({
  name,position:{x:0,y:0,z:0},rotation:{x:0},userData:{
   animationEligible:["ALT1_pulley","ALT1_rotor_shaft"].includes(name),
   runtimeDrivenOnly:["ALT1_pulley","ALT1_rotor_shaft"].includes(name),
   rotationAxis:"X",engineeringAuthority:false,measurementAuthority:false,publicationAuthority:false
  }
 }));
 return {nodes,getObjectByName(name){return nodes.find(x=>x.name===name)}};
}
describe("governed alternator runtime motion",()=>{
 test("shaft and pulley rotate together while housing and terminals remain stationary",async()=>{
  const {createAlternatorMotion}=await create();const scene=makeScene(),control=createAlternatorMotion(scene);
  expect(control.start()).toBe(true);
  expect(control.step(0.05,1200)).toBe(true);
  expect(scene.getObjectByName("ALT1_pulley").rotation.x).toBeCloseTo(scene.getObjectByName("ALT1_rotor_shaft").rotation.x);
  expect(scene.getObjectByName("ALT1_housing_front").rotation.x).toBe(0);
  expect(scene.getObjectByName("ALT1_output_stud").rotation.x).toBe(0);
  control.pause();expect(control.step(0.02,1200)).toBe(false);
  control.reset();expect(scene.getObjectByName("ALT1_pulley").rotation.x).toBe(0);
  control.dispose();
 });
 test("reduced motion prevents automatic movement",async()=>{
  const {createAlternatorMotion}=await create();const c=createAlternatorMotion(makeScene(),{reducedMotion:true});
  expect(c.start()).toBe(false);expect(c.step(0.02,900)).toBe(false);
 });
 test("invalid authority, missing parts, or invalid speed fail closed",async()=>{
  const {createAlternatorMotion}=await create();
  const s=makeScene();s.getObjectByName("ALT1_pulley").userData.engineeringAuthority=true;
  expect(()=>createAlternatorMotion(s)).toThrow(/contract/);
  const s2=makeScene();s2.nodes.pop();expect(()=>createAlternatorMotion(s2)).toThrow(/Incomplete/);
  const c=createAlternatorMotion(makeScene());c.start();
  expect(()=>c.step(0.02,-1)).toThrow(RangeError);
  expect(()=>c.step(0.02,16000)).toThrow(RangeError);
  expect(()=>c.step(0.5,1000)).toThrow(RangeError);
 });
});

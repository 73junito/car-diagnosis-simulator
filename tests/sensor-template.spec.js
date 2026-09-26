"use strict";
const fs=require("fs"), path=require("path");
const engine=require("../src/circuits/engine");
const {validateCircuitTemplate}=require("../src/circuits/template-contracts");
const {SymbolRegistry}=require("../src/symbols/registry");
const {ConnectionStyleRegistry}=require("../src/connections");
const read=(f)=>JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));
describe("12 V three-wire sensor template",()=>{
 const root=path.resolve(__dirname,"..");
 const template=read(path.join(root,"data/circuit-templates/12v-three-wire-sensor.json"));
 const manifest=read(path.join(root,"data/symbols/manifest.json"));
 const symbols=manifest.domains.flatMap(d=>read(path.join(root,"data/symbols",d.file)).symbols);
 const connections=read(path.join(root,"data/connections/electrical.json"));
 const sr=new SymbolRegistry().registerMany(symbols);
 const cr=new ConnectionStyleRegistry(connections.styles);
 test("satisfies reusable template/library contracts and declares both voltages",()=>{
  expect(validateCircuitTemplate(template,engine,sr,cr)).toEqual({valid:true,errors:[]});
  expect(template.voltageSystems.map(v=>v.nominalVoltage)).toEqual([12,5]);
  expect(template.components).toHaveLength(6); expect(template.connections).toHaveLength(8);
  expect(template.testPoints).toHaveLength(4); expect(template.faultCatalog).toHaveLength(6);
 });
 test("active state separates supply, analog signal, and ground",()=>{
  const s=template.operatingStates.find(x=>x.id==="active-signal");
  expect(s.activeFlows.power.map(([id])=>id)).toContain("W_REF_SENSOR_PWR");
  expect(s.activeFlows.signal.map(([id])=>id)).toEqual(["W_SENSOR_SIGNAL"]);
  expect(s.activeFlows.ground.map(([id])=>id)).toContain("W_SENSOR_GND");
 });
 test("open and high-resistance sensor faults alter only targeted edges",()=>{
  const open=engine.buildAdjacency(template,["FAULT_OPEN_SIGNAL"]);
  expect((open.get("SENSOR1_SIGNAL") || []).some(e=>e.edge.id==="W_SENSOR_SIGNAL")).toBe(false);
  const high=engine.buildAdjacency(template,["FAULT_HIGH_RES_SENSOR_GROUND"]);
  expect(high.get("SENSOR1_GND").find(e=>e.edge.id==="W_SENSOR_GND").edge.degraded).toBe(true);
 });
 test("short faults create explicit unintended adjacency edges",()=>{
  const g=engine.buildAdjacency(template,["FAULT_SIGNAL_SHORT_GROUND"]);
  expect(g.get("SENSOR1_SIGNAL").some(e=>e.terminalId==="GND1_MAIN"&&e.edge.fault)).toBe(true);
  const p=engine.buildAdjacency(template,["FAULT_SIGNAL_SHORT_POWER"]);
  expect(p.get("SENSOR1_SIGNAL").some(e=>e.terminalId==="REF1_OUT"&&e.edge.fault)).toBe(true);
 });
});

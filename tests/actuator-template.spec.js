"use strict";
const fs=require("fs"),path=require("path");
const engine=require("../src/circuits/engine");
const {validateCircuitTemplate}=require("../src/circuits/template-contracts");
const {SymbolRegistry}=require("../src/symbols/registry");
const {ConnectionStyleRegistry}=require("../src/connections");
const read=f=>JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));
describe("12 V PWM actuator template",()=>{
 const root=path.resolve(__dirname,"..");
 const template=read(path.join(root,"data/circuit-templates/12v-pwm-actuator.json"));
 const manifest=read(path.join(root,"data/symbols/manifest.json"));
 const symbols=manifest.domains.flatMap(d=>read(path.join(root,"data/symbols",d.file)).symbols);
 const styles=read(path.join(root,"data/connections/electrical.json"));
 const sr=new SymbolRegistry().registerMany(symbols),cr=new ConnectionStyleRegistry(styles.styles);
 test("satisfies template and library contracts",()=>{
  expect(validateCircuitTemplate(template,engine,sr,cr)).toEqual({valid:true,errors:[]});
  expect(template.voltageSystems[0].nominalVoltage).toBe(12);
  expect(template.components).toHaveLength(5);expect(template.connections).toHaveLength(7);
  expect(template.testPoints).toHaveLength(4);expect(template.faultCatalog).toHaveLength(7);
  expect(sr.get("electrical.actuator-three-wire").terminals.map(t=>t.id)).toEqual(["power","ground","control"]);
 });
 test("PWM examples keep power and command paths distinct",()=>{
  for(const id of["pwm-low-example","pwm-high-example"]){
   const s=template.operatingStates.find(x=>x.id===id);
   expect(s.activeFlows.control.map(([edge])=>edge)).toEqual(["W_ECM_PWM"]);
   expect(s.activeFlows.power.map(([edge])=>edge)).toEqual(expect.arrayContaining(["W_BAT_FUSE","W_FUSE_ACT","W_BAT_ECM"]));
   expect(s.trainingDutyCycleLabel).toMatch(/training example/i);
  }
 });
 test("open and high resistance faults alter only targeted actuator paths",()=>{
  const open=engine.buildAdjacency(template,["FAULT_OPEN_PWM"]);
  expect((open.get("ACT1_PWM")||[]).some(e=>e.edge.id==="W_ECM_PWM")).toBe(false);
  const high=engine.buildAdjacency(template,["FAULT_HIGH_RES_ACT_GROUND"]);
  expect(high.get("ACT1_GND").find(e=>e.edge.id==="W_ACT_GND").edge.degraded).toBe(true);
 });
 test("PWM shorts create explicit unintended graph edges",()=>{
  const ground=engine.buildAdjacency(template,["FAULT_PWM_SHORT_GROUND"]);
  expect(ground.get("ACT1_PWM").some(e=>e.terminalId==="GND1_MAIN"&&e.edge.fault)).toBe(true);
  const power=engine.buildAdjacency(template,["FAULT_PWM_SHORT_POWER"]);
  expect(power.get("ACT1_PWM").some(e=>e.terminalId==="BAT1_POS"&&e.edge.fault)).toBe(true);
 });
});
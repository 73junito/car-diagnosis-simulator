"use strict";
const fs=require("fs"),path=require("path");
const engine=require("../src/circuits/engine");
const {validateCircuitTemplate}=require("../src/circuits/template-contracts");
const {SymbolRegistry}=require("../src/symbols/registry");
const {ConnectionStyleRegistry}=require("../src/connections");
const read=f=>JSON.parse(fs.readFileSync(f,"utf8").replace(/^\uFEFF/,""));
describe("12 V CAN/LIN network template",()=>{
 const root=path.resolve(__dirname,"..");
 const template=read(path.join(root,"data/circuit-templates/12v-can-lin-network.json"));
 const manifest=read(path.join(root,"data/symbols/manifest.json"));
 const symbols=manifest.domains.flatMap(d=>read(path.join(root,"data/symbols",d.file)).symbols);
 const styles=read(path.join(root,"data/connections/electrical.json"));
 const sr=new SymbolRegistry().registerMany(symbols),cr=new ConnectionStyleRegistry(styles.styles);
 test("satisfies reusable template and network symbol contracts",()=>{
  expect(validateCircuitTemplate(template,engine,sr,cr)).toEqual({valid:true,errors:[]});
  expect(template.voltageSystems[0].nominalVoltage).toBe(12);
  expect(template.components).toHaveLength(7);
  expect(template.connections).toHaveLength(15);
  expect(template.testPoints).toHaveLength(5);
  expect(template.faultCatalog).toHaveLength(8);
  expect(sr.get("electrical.network-module").terminals.map(t=>t.id)).toEqual(["power","ground","can_h","can_l","lin"]);
 });
 test("CAN and LIN states remain distinct",()=>{
  const can=template.operatingStates.find(x=>x.id==="can-active");
  expect(can.activeFlows.can).toHaveLength(4);expect(can.activeFlows.lin).toHaveLength(0);
  const both=template.operatingStates.find(x=>x.id==="can-lin-active");
  expect(both.activeFlows.can).toHaveLength(4);expect(both.activeFlows.lin).toHaveLength(1);
  expect(both.activeFlows.power).toHaveLength(5);expect(both.activeFlows.ground).toHaveLength(5);
 });
 test("open CAN and LIN faults remove targeted network conductors",()=>{
  const can=engine.buildAdjacency(template,["FAULT_OPEN_CAN_H"]);
  expect((can.get("CAN_A_CAN_H")||[]).some(e=>e.edge.id==="W_CAN_H_A_B")).toBe(false);
  const lin=engine.buildAdjacency(template,["FAULT_OPEN_LIN"]);
  expect((lin.get("LIN_A_LIN")||[]).some(e=>e.edge.id==="W_LIN_GW_A")).toBe(false);
 });
 test("network shorts create explicit unintended adjacency edges",()=>{
  const ground=engine.buildAdjacency(template,["FAULT_CAN_H_SHORT_GROUND"]);
  expect(ground.get("CAN_A_CAN_H").some(e=>e.terminalId==="GND1_MAIN"&&e.edge.fault)).toBe(true);
  const power=engine.buildAdjacency(template,["FAULT_CAN_H_SHORT_POWER"]);
  expect(power.get("CAN_A_CAN_H").some(e=>e.terminalId==="BAT1_POS"&&e.edge.fault)).toBe(true);
  const lines=engine.buildAdjacency(template,["FAULT_CAN_LINES_SHORTED"]);
  expect(lines.get("CAN_A_CAN_H").some(e=>e.terminalId==="CAN_A_CAN_L"&&e.edge.type==="short_between_lines")).toBe(true);
 });
});
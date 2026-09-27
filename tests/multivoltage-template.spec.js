"use strict";

const fs=require("fs");
const path=require("path");
const engine=require("../src/circuits/engine");
const voltageDomains=require("../src/circuits/voltage-domains");
const {validateCircuitTemplate}=require("../src/circuits/template-contracts");
const {SymbolRegistry}=require("../src/symbols/registry");
const {ConnectionStyleRegistry}=require("../src/connections");

const read=(file)=>JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));

describe("electrified multi-voltage training template",()=>{
  const root=path.resolve(__dirname,"..");
  const template=read(path.join(root,"data/circuit-templates/electrified-multivoltage.json"));
  const manifest=read(path.join(root,"data/symbols/manifest.json"));
  const symbols=manifest.domains.flatMap((domain)=>read(path.join(root,"data/symbols",domain.file)).symbols);
  const connections=read(path.join(root,"data/connections/electrical.json"));
  const symbolRegistry=new SymbolRegistry().registerMany(symbols);
  const connectionRegistry=new ConnectionStyleRegistry(connections.styles);

  test("satisfies reusable template and multi-voltage library contracts",()=>{
    expect(validateCircuitTemplate(template,engine,symbolRegistry,connectionRegistry)).toEqual({valid:true,errors:[]});
    expect(template.powertrainType).toBe("electrified-training");
    expect(template.voltageSystems.map((system)=>system.nominalVoltage)).toEqual([12,400]);
    expect(template.components).toHaveLength(8);
    expect(template.connections).toHaveLength(13);
    expect(template.testPoints).toHaveLength(5);
    expect(template.faultCatalog).toHaveLength(7);
    expect(symbolRegistry.get("electrical.dc-dc-converter").terminals.map((terminal)=>terminal.id)).toEqual(["hv_pos","hv_neg","lv_pos","lv_neg"]);
    expect(symbolRegistry.get("electrical.traction-inverter").terminals.map((terminal)=>terminal.id)).toEqual(["dc_pos","dc_neg","motor_a","motor_b","control"]);
    expect(connectionRegistry.get("electrical.traction-return").strokeRole).toBe("traction");
  });

  test("declared architecture preserves explicit low-voltage and traction domains",()=>{
    const architecture=voltageDomains.describeVoltageArchitecture(template);
    expect(architecture.map((item)=>item.label)).toEqual([
      "12 V nominal — low-voltage domain",
      "400 V nominal — training example traction domain"
    ]);
    expect(architecture.map((item)=>item.domainClass)).toEqual(["lv-12","traction"]);
    expect(architecture.every((item)=>item.powertrainLabel==="Electrified vehicle training")).toBe(true);

    const lvConnections=template.connections.filter((connection)=>connection.voltageSystemId==="LV12");
    const tractionConnections=template.connections.filter((connection)=>connection.voltageSystemId==="TR400");
    expect(lvConnections).toHaveLength(7);
    expect(tractionConnections).toHaveLength(6);
    expect(tractionConnections.every((connection)=>["electrical.traction-power","electrical.traction-return"].includes(connection.styleId))).toBe(true);
  });

  test("DC/DC converter is explicitly declared as a cross-domain training component",()=>{
    const converter=template.components.find((component)=>component.id==="DCDC1");
    expect(converter.crossDomain).toBe(true);
    expect(converter.voltageSystemIds).toEqual(["TR400","LV12"]);
    expect(converter.voltageSystemId).toBe("TR400");
  });

  test("operating states keep low-voltage, control, and traction flows distinct",()=>{
    const dcdc=template.operatingStates.find((state)=>state.id==="dcdc-support");
    expect(dcdc.activeFlows.lvPower.map(([id])=>id)).toContain("W_DCDC_LV_POS");
    expect(dcdc.activeFlows.traction.map(([id])=>id)).toEqual(["W_HV_DCDC_POS"]);
    expect(dcdc.activeFlows.tractionReturn.map(([id])=>id)).toEqual(["W_HV_DCDC_NEG"]);
    expect(dcdc.activeFlows.control).toHaveLength(0);

    const drive=template.operatingStates.find((state)=>state.id==="traction-drive-example");
    expect(drive.activeFlows.lvPower).toHaveLength(2);
    expect(drive.activeFlows.lvGround).toHaveLength(2);
    expect(drive.activeFlows.control).toEqual([["W_CTRL_INV","forward"]]);
    expect(drive.activeFlows.traction).toHaveLength(3);
    expect(drive.activeFlows.tractionReturn).toHaveLength(1);
  });

  test("low-voltage and traction faults remain scoped to their targeted conductors",()=>{
    const lvOpen=engine.buildAdjacency(template,["FAULT_OPEN_LV_MODULE_POWER"]);
    expect((lvOpen.get("CTRL1_PWR")||[]).some((edge)=>edge.edge.id==="W_FUSE_CTRL")).toBe(false);
    expect((lvOpen.get("HVBAT_POS")||[]).some((edge)=>edge.edge.id==="W_HV_INV_POS")).toBe(true);

    const tractionOpen=engine.buildAdjacency(template,["FAULT_OPEN_TRACTION_FEED"]);
    expect((tractionOpen.get("INV_DC_POS")||[]).some((edge)=>edge.edge.id==="W_HV_INV_POS")).toBe(false);
    expect((tractionOpen.get("CTRL1_PWR")||[]).some((edge)=>edge.edge.id==="W_FUSE_CTRL")).toBe(true);
  });

  test("traction test points are explicitly conceptual-only",()=>{
    const tractionPoints=template.testPoints.filter((point)=>point.trainingSafetyBoundary==="conceptual-only");
    expect(tractionPoints.map((point)=>point.id)).toEqual(["TP_TRACTION_POS","TP_TRACTION_RETURN"]);
  });
});

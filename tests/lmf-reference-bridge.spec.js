'use strict';
const bridge=require('../src/simulation/lmf-reference-bridge');
const template=require('../data/circuit-templates/12v-starting-system-v2.json');
const expected=require('./simulators/starting-system-v2-expected-values.json');
describe('LMF headless starting reference bridge',()=>{
 test('healthy crank model reports traceable voltage matching independent fixture',()=>{
  const result=bridge.runLmfStartingReference(template,{modelRef:'/data/circuit-templates/12v-starting-system-v2.json',operatingStateId:'crank',testPointId:'TP_BAT_POS'});
  expect(result.status).toBe('solved');
  expect(result.measurement.unit).toBe('V');
  expect(result.measurement.value).toBeCloseTo(expected.scenarios.find(s=>s.scenarioId==='healthy-crank').testPointVoltagesV.TP_BAT_POS,4);
  expect(result.provenance.solverId).toBe('typescript-mna');
 });
 test.each([
  ['healthy-crank',null],
  ['open-motor-feed','FAULT_OPEN_POWER'],
  ['open-control-circuit','FAULT_OPEN_CONTROL']
 ])('compares supported voltages to independent %s fixture', (scenarioId,faultId)=>{
   const scenario=expected.scenarios.find(s=>s.scenarioId===scenarioId);
   for(const testPointId of ['TP_BAT_POS','TP_START_CMD','TP_SOLENOID_OUT']){
     const result=bridge.runLmfStartingReference(template,{modelRef:'/data/circuit-templates/12v-starting-system-v2.json',operatingStateId:'crank',testPointId,...(faultId?{faultId}:{})});
     expect(result.status).toBe('solved');
     expect(result.measurement.value).toBeCloseTo(scenario.testPointVoltagesV[testPointId],4);
   }
 });
 test('unsupported faults or models cannot silently produce healthy values',()=>{
  const arg={modelRef:'/data/circuit-templates/12v-starting-system-v2.json',operatingStateId:'crank',testPointId:'TP_BAT_POS'};
  expect(bridge.runLmfStartingReference(template,{...arg,faultId:'FAULT_HIGH_RES_GROUND'}).measurement).toBeNull();
  expect(bridge.runLmfStartingReference(template,{...arg,faultId:'FAULT_OPEN_COIL'}).measurement).toBeNull();
  expect(bridge.runLmfStartingReference(template,{...arg,faultId:'FAULT_HIGH_RES_POWER'}).measurement).toBeNull();
  expect(()=>bridge.runLmfStartingReference(template,{...arg,modelRef:'/data/circuits/generic-charging-system.json'})).toThrow();
 });
});

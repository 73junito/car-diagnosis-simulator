const {create}=require('../engine/sharedCoolingFanSimulation');
const {validate,project}=require('../engine/simulationStateAdapters');
describe('shared state display adapters',()=>{
 test('projects the exact same state to instruments, animation and charts',()=>{
  const state=create().step(5), view=project(state);
  expect(view.instruments.multimeter.value).toBe(state.electrical.supplyVoltageV);
  expect(view.instruments.currentClamp.value).toBe(state.electrical.fanCurrentA);
  expect(view.animation.fanAngleRad).toBe(state.visual.fanAngleRad);
  expect(view.charts.coolantC).toBe(state.thermal.coolantC);
  expect(view.timeS).toBe(state.simulationTimeS);
 });
 test('rejects unauthorized assessment claim',()=>{
  const state=create().snapshot();
  expect(()=>project({...state,authority:{...state.authority,assessmentEligible:true}})).toThrow();
 });
 test('rejects mismatched visualization and corrupt values',()=>{
  const s=create().snapshot();
  expect(()=>validate({...s,visual:{...s.visual,fanRunning:false}})).toThrow();
  expect(()=>validate({...s,electrical:{...s.electrical,fanCurrentA:NaN}})).toThrow();
 });
 test('rejects unsupported model and vehicle measurements',()=>{
  const s=create().snapshot();
  expect(()=>project({...s,modelId:'another-model'})).toThrow();
  expect(()=>project({...s,authority:{...s.authority,vehicleMeasurement:true}})).toThrow();
 });
});

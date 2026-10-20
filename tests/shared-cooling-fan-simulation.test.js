const {create,normalize}=require('../engine/sharedCoolingFanSimulation');
describe('shared illustrative simulation state',()=>{
 test('same input and time produce the same state',()=>{
   const a=create(),b=create();
   expect(a.step(5)).toEqual(b.step(5));
 });
 test('fan-open fault stops fan and current, without inventing diagnosis',()=>{
   const state=create({fault:'fan-open'}).step(5);
   expect(state.electrical.fanRunning).toBe(false);
   expect(state.electrical.fanCurrentA).toBe(0);
   expect(state.evidence.diagnosticConclusion).toBeNull();
   expect(state.authority.assessmentEligible).toBe(false);
 });
 test('heat simulation responds to fan operation',()=>{
   const on=create({initialCoolantC:90}).step(60);
   const off=create({initialCoolantC:90,fanCommand:false}).step(60);
   expect(on.thermal.coolantC).toBeLessThan(off.thermal.coolantC);
 });
 test('reset reproduces initial state',()=>{
   const sim=create();const initial=sim.snapshot();sim.step(5);expect(sim.reset()).toEqual(initial);
 });
 test('rejects invalid model inputs and step sizes',()=>{
   expect(()=>normalize({ambientC:NaN})).toThrow();
   expect(()=>normalize({fault:'unknown'})).toThrow();
   expect(()=>create().step(-1)).toThrow();
 });
 test('snapshots carry explicit synthetic provenance',()=>{
   const s=create().snapshot();
   expect(s.evidence.measurementSource).toBe('illustrative_simulation');
   expect(s.authority.vehicleMeasurement).toBe(false);
   expect(s.authority.manufacturerSpecification).toBe(false);
 });
});

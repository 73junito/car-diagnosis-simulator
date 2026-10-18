'use strict';
const {MODEL,current,voltage,resistance,power,calculate,compare}=require('../engine/circuitLabCalculations');
test('ideal illustrative 12 V 6 ohm circuit yields 2 A 24 W',()=>{
 const r=calculate({voltageV:12,resistanceOhm:6});
 expect(r.current.value).toBe(2);expect(r.power.value).toBe(24);
 expect(r.assessmentEligible).toBe(false);
 expect(r.current.validatedAgainstManufacturer).toBe(false);
 expect(r.model).toBe(MODEL);
});
test('solves ideal equations with explicit units',()=>{
 expect(current({voltageV:5,resistanceOhm:10})).toMatchObject({value:0.5,unit:'A'});
 expect(voltage({currentA:2,resistanceOhm:3})).toMatchObject({value:6,unit:'V'});
 expect(resistance({voltageV:12,currentA:2})).toMatchObject({value:6,unit:'ohm'});
 expect(power({voltageV:12,currentA:2})).toMatchObject({value:24,unit:'W'});
});
test('rejects invalid and nonphysical resistive inputs',()=>{
 for(const r of [0,-2,NaN,Infinity,'6'])expect(()=>current({voltageV:12,resistanceOhm:r})).toThrow();
 expect(()=>resistance({voltageV:12,currentA:0})).toThrow();
 expect(()=>calculate({voltageV:'12',resistanceOhm:6})).toThrow();
});
test('discrepancy is only numeric and missing data stays missing',()=>{
 expect(compare({predicted:2,measured:2.2,unit:'A'})).toMatchObject({status:'compared',difference:0.20000000000000018,percentDifference:10.000000000000009,assessmentEligible:false});
 expect(compare({predicted:2,unit:'A'})).toMatchObject({status:'not_supplied',difference:null,percentDifference:null});
 expect(compare({predicted:0,measured:0,unit:'A'}).percentDifference).toBeNull();
});
test('rejects nonfinite observations, does not interpret pass/fail',()=>{
 expect(()=>compare({predicted:2,measured:Infinity,unit:'A'})).toThrow();
 expect(()=>compare({predicted:2,measured:2.1,unit:''})).toThrow();
 expect(compare({predicted:2,measured:2.1,unit:'A'}).interpretation).toMatch(/independent criteria/);
});

'use strict';
// Deterministic, standalone ideal-DC calculations. No grades, vehicle OEM limits, telemetry or I/O.
const MODEL='ideal-resistive-dc-v1';
function positive(value,label){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new RangeError(label+' must be a positive finite number');return value;}
function finite(value,label){if(typeof value!=='number'||!Number.isFinite(value))throw new RangeError(label+' must be a finite number');return value;}
function result(value,unit){return Object.freeze({value,unit,model:MODEL,illustrative:true,validatedAgainstManufacturer:false});}
function current({voltageV,resistanceOhm}){return result(finite(voltageV,'voltageV')/positive(resistanceOhm,'resistanceOhm'),'A');}
function voltage({currentA,resistanceOhm}){return result(finite(currentA,'currentA')*positive(resistanceOhm,'resistanceOhm'),'V');}
function resistance({voltageV,currentA}){const i=finite(currentA,'currentA');if(i===0)throw new RangeError('currentA cannot be zero');const r=finite(voltageV,'voltageV')/i;return result(positive(r,'calculated resistance'),'ohm');}
function power({voltageV,currentA}){return result(finite(voltageV,'voltageV')*finite(currentA,'currentA'),'W');}
function calculate({voltageV,resistanceOhm}){const i=current({voltageV,resistanceOhm});return Object.freeze({model:MODEL,assumptions:['steady state','ideal DC source','constant resistive load'],voltage:result(voltageV,'V'),resistance:result(resistanceOhm,'ohm'),current:i,power:power({voltageV,currentA:i.value}),assessmentEligible:false});}
function compare({predicted,measured,unit}){finite(predicted,'predicted');if(typeof unit!=='string'||!unit.trim())throw new TypeError('unit is required');if(measured===null||measured===undefined)return Object.freeze({status:'not_supplied',difference:null,absoluteDifference:null,percentDifference:null,unit,interpretation:'No measurement supplied; no discrepancy can be evaluated',assessmentEligible:false});finite(measured,'measured');const difference=measured-predicted;return Object.freeze({status:'compared',predicted,measured,difference,absoluteDifference:Math.abs(difference),percentDifference:predicted===0?null:Math.abs(difference)/Math.abs(predicted)*100,unit,interpretation:'Numerical discrepancy only; technical acceptability needs independent criteria and source applicability',assessmentEligible:false});}
module.exports={MODEL,current,voltage,resistance,power,calculate,compare};

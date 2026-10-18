'use strict';
const {calculate,compare}=require('../../../../engine/circuitLabCalculations');
function parseRequired(raw,name){if(raw.trim()==='')throw new Error(name+' is required');const n=Number(raw);if(!Number.isFinite(n))throw new Error(name+' must be a finite number');return n;}
function renderCalculation({voltageText,resistanceText,measuredText}){
 const voltageV=parseRequired(voltageText,'Voltage');
 const resistanceOhm=parseRequired(resistanceText,'Resistance');
 const estimate=calculate({voltageV,resistanceOhm});
 const measured=measuredText.trim()===''?undefined:parseRequired(measuredText,'Measured current');
 const comparison=compare({predicted:estimate.current.value,measured,unit:'A'});
 const fmt=x=>Number(x).toLocaleString('en-US',{maximumFractionDigits:6});
 const rows=[['Predicted current',fmt(estimate.current.value)+' A'],['Predicted power',fmt(estimate.power.value)+' W'],['Model',estimate.model],['Measurement',comparison.status==='not_supplied'?'Not supplied':fmt(measured)+' A'],['Difference (measured − predicted)',comparison.difference===null?'Not supplied':fmt(comparison.difference)+' A'],['Absolute difference',comparison.absoluteDifference===null?'Not supplied':fmt(comparison.absoluteDifference)+' A'],['Percent magnitude difference',comparison.percentDifference===null?'Not defined / not supplied':fmt(comparison.percentDifference)+'%'],['Technical compliance','Not determined; no applicable manufacturer criteria supplied']];
 return rows;
}
function mount(doc){
 const form=doc.getElementById('calculator');if(!form)return false;
 const output=doc.getElementById('results'),error=doc.getElementById('error');
 form.addEventListener('submit',e=>{
  e.preventDefault();error.hidden=true;error.textContent='';
  try{
   const rows=renderCalculation({voltageText:doc.getElementById('voltage').value,resistanceText:doc.getElementById('resistance').value,measuredText:doc.getElementById('measured').value});
   const dl=doc.createElement('dl');
   for(const [name,value] of rows){const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=name;dd.textContent=value;dl.append(dt,dd);}
   output.replaceChildren(dl);
  }catch(err){output.textContent='Calculation unavailable. Correct the inputs and try again.';error.textContent=err.message;error.hidden=false;}
 });
 return true;
}
if(typeof document!=='undefined')mount(document);
module.exports={renderCalculation,mount};

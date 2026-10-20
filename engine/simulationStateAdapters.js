"use strict";
/** Pure display projections of a known *illustrative* shared cooling-fan state.
 * Does not mutate lab engines or grant measurement/assessment authority.
 */
const MODEL_ID="cooling-fan-illustrative-v1";
function validate(state){
 if(!state || typeof state!=="object" || state.schemaVersion!=="1.0.0" || state.modelId!==MODEL_ID)throw Error("Unsupported simulation state");
 if(state.authority?.kind!=="project_authored_training_model"||state.authority?.vehicleMeasurement!==false||state.authority?.manufacturerSpecification!==false||state.authority?.assessmentEligible!==false)throw Error("Invalid simulation authority");
 if(state.evidence?.measurementSource!=="illustrative_simulation"||state.evidence?.diagnosticConclusion!==null)throw Error("Invalid simulation provenance");
 const fields=[state.simulationTimeS,state.thermal?.coolantC,state.thermal?.ambientC,state.electrical?.supplyVoltageV,state.electrical?.fanCurrentA,state.visual?.fanAngleRad];
 if(fields.some(n=>typeof n!=="number"||!Number.isFinite(n)))throw Error("Invalid numeric state");
 if(state.simulationTimeS<0 || typeof state.electrical.fanRunning!=="boolean" || typeof state.visual.fanRunning!=="boolean" || state.visual.fanRunning!==state.electrical.fanRunning)throw Error("Inconsistent visual state");
 return state;
}
function project(state) {
 const s=validate(state);
 const provenance=Object.freeze({modelId:MODEL_ID,kind:"illustrative_simulation",assessmentEligible:false});
 return Object.freeze({
  timeS:s.simulationTimeS,
  instruments:Object.freeze({
    multimeter:Object.freeze({mode:"dc-voltage",value:s.electrical.supplyVoltageV,unit:"V",provenance}),
    currentClamp:Object.freeze({value:s.electrical.fanCurrentA,unit:"A",provenance}),
    temperature:Object.freeze({value:s.thermal.coolantC,unit:"°C",provenance})
  }),
  animation:Object.freeze({fanAngleRad:s.visual.fanAngleRad,fanRunning:s.visual.fanRunning,provenance}),
  charts:Object.freeze({timeS:s.simulationTimeS,coolantC:s.thermal.coolantC,fanVoltageV:s.electrical.supplyVoltageV,fanCurrentA:s.electrical.fanCurrentA,provenance})
 });
}
module.exports={validate,project};

"use strict";
/**
 * Isolated, educational electrical/thermal state model.
 * NOT a real vehicle, OEM specification, diagnostic limit or assessment engine.
 * All physical constants are intentionally illustrative.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof window !== "undefined") root.TorqueMindCoolingDemo = api;
})(typeof globalThis === "object" ? globalThis : this, function() {
  const MODEL_ID = "cooling-fan-illustrative-v1";
  const DEFAULTS = Object.freeze({ambientC:25, initialCoolantC:25, heatLoadPct:65, fanCommand:true, fault:"none"});
  const FAULTS = Object.freeze(["none","fan-open","low-supply"]);
  function finite(n, name, lo, hi) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
      throw new RangeError(name + " must be a finite number in [" + lo + "," + hi + "]");
    return n;
  }
  function normalize(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("configuration must be an object");
    const c = {...DEFAULTS,...input};
    finite(c.ambientC,"ambientC",-20,60);
    finite(c.initialCoolantC,"initialCoolantC",-20,150);
    finite(c.heatLoadPct,"heatLoadPct",0,100);
    if (typeof c.fanCommand !== "boolean") throw new TypeError("fanCommand must be boolean");
    if (!FAULTS.includes(c.fault)) throw new RangeError("unsupported fault");
    return c;
  }
  function create(config = {}) {
    const c=normalize(config);
    let time=0, coolantC=c.initialCoolantC;
    function snapshot() {
      const suppliedVoltageV=c.fault==="low-supply"?9:13.8;
      const fanRunning=c.fanCommand && c.fault!=="fan-open";
      // Simplified illustrative electrical behavior; no motor curve or airflow fidelity.
      const fanCurrentA=fanRunning ? (c.fault==="low-supply"?8:12) : 0;
      return Object.freeze({
        schemaVersion:"1.0.0", modelId:MODEL_ID, simulationTimeS:time,
        authority:Object.freeze({kind:"project_authored_training_model",vehicleMeasurement:false,manufacturerSpecification:false,assessmentEligible:false}),
        configuration:Object.freeze({...c}),
        electrical:Object.freeze({fanCommand:c.fanCommand,fanRunning,supplyVoltageV:suppliedVoltageV,fanCurrentA}),
        thermal:Object.freeze({ambientC:c.ambientC,coolantC,heatLoadPct:c.heatLoadPct}),
        visual:Object.freeze({fanAngleRad:(fanRunning ? (time*6)%(Math.PI*2) : 0),fanRunning,temperatureC:coolantC}),
        evidence:Object.freeze({fault:c.fault,measurementSource:"illustrative_simulation",diagnosticConclusion:null})
      });
    }
    function step(seconds) {
      finite(seconds,"seconds",0,60);
      // Stable explicit-Euler 1st-order toy model; time in seconds, temperature in C.
      // Heat gain and cooling deliberately independent of actual vehicle physics.
      const slices=Math.ceil(seconds/0.1);
      if (!slices) return snapshot();
      const dt=seconds/slices;
      for(let i=0;i<slices;i++){
        const running=c.fanCommand && c.fault!=="fan-open";
        const heatGain=0.016*c.heatLoadPct/100;
        const cooling=(coolantC-c.ambientC)*(running?0.0025:0.0006);
        coolantC+=dt*(heatGain-cooling);
      }
      time+=seconds;
      return snapshot();
    }
    return Object.freeze({snapshot,step,reset:()=>{time=0;coolantC=c.initialCoolantC;return snapshot();}});
  }
  return Object.freeze({create,normalize,MODEL_ID,FAULTS,DEFAULTS});
});

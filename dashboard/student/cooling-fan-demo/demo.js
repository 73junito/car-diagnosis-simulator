"use strict";
(function(){
 const $=id=>document.getElementById(id);
 const model=window.TorqueMindCoolingDemo;
 if(!model){$("status").textContent="Simulation module unavailable";return;}
 let sim;
 function render(state){
   $("time").textContent=state.simulationTimeS.toFixed(1)+" s";
   $("coolant").textContent=state.thermal.coolantC.toFixed(2)+" °C";
   $("voltage").textContent=state.electrical.supplyVoltageV.toFixed(1)+" V";
   $("current").textContent=state.electrical.fanCurrentA.toFixed(1)+" A";
   $("fan").textContent=state.electrical.fanRunning?"Running":"Stopped";
   $("fanLabel").textContent=state.electrical.fanRunning?"Running":"Stopped";
   $("blades").setAttribute("transform","rotate("+(state.visual.fanAngleRad*180/Math.PI)+" 110 90)");
   $("status").textContent="Illustrative simulation updated at "+state.simulationTimeS.toFixed(1)+" seconds";
 }
 function apply(){
   try {
     sim=model.create({ambientC:Number($("ambient").value),heatLoadPct:Number($("heat").value),fanCommand:$("command").checked,fault:$("fault").value});
     render(sim.snapshot());
   }catch(error){$("status").textContent="Invalid settings: "+error.message;}
 }
 $("apply").addEventListener("click",apply);
 $("step").addEventListener("click",()=>{if(sim)render(sim.step(5));});
 apply();
})();

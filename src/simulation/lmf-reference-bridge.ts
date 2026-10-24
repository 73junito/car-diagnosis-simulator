/** Headless LMF reference bridge: approved v2 fixture only; not a production lab binding. */
import { solveWithRelayCoupling } from './electrical-adapter';
import type { RelayCoupling } from '../../contracts/model';
import type { MnaSuccess } from './mna';
const REF='/data/circuit-templates/12v-starting-system-v2.json';
export function runLmfStartingReference(template: any, request: {modelRef:string;operatingStateId:string;testPointId:string;faultId?:string}) {
 if(request.modelRef!==REF) throw new Error('Reference model not registered');
 const states=new Set((template.operatingStates||[]).map((s:any)=>s.id));
 if(!states.has(request.operatingStateId))throw new Error('Unknown operating state');
 const point=(template.testPoints||[]).find((x:any)=>x.id===request.testPointId);
 if(!point||!point.measurementTypes.includes('voltage'))throw new Error('Voltage measurement not declared');
 const fault=request.faultId?(template.faultCatalog||[]).find((f:any)=>f.id===request.faultId):null;
 if(request.faultId&&!fault)throw new Error('Unknown fault');
 if(fault && fault.type!=='open_circuit')return {status:'unsupported-fault',measurement:null};
 // Fault translation is explicitly deferred; do not silently solve a healthy circuit.
 if(fault)return {status:'fault-adapter-not-connected',measurement:null};
 const result=solveWithRelayCoupling({template,modelRef:REF,operatingStateId:request.operatingStateId,
  removedElementIds:[],relayCouplings:(template.relayCouplings||[]) as RelayCoupling[]});
 if(!result.ok)return {status:'solver-refused',measurement:null,failure:result.failure};
 const node=result.netlist.testPointToNode[request.testPointId];
 if(!node)return {status:'measurement-unavailable',measurement:null};
 const voltage=(result.solution as MnaSuccess).nodeVoltageAbsolute[node];
 if(!Number.isFinite(voltage))return {status:'measurement-unavailable',measurement:null};
 return {status:'solved',measurement:{measurementType:'voltage',value:voltage,unit:'V',sourceRole:'engineering-model-derived'},
  provenance:{solverId:'typescript-mna',modelRef:REF,templateVersion:template.templateVersion,engine:'headless-reference'}};
}

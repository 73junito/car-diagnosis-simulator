/** Headless LMF reference bridge: approved v2 fixture only; not a production lab binding. */
import { solveWithRelayCoupling } from './electrical-adapter';
import type { RelayCoupling } from '../../contracts/model';
import type { MnaSuccess } from './mna';
import { canonicalVoltageRecord } from './lmf-measurement';
import { ELECTRICAL_SOLVER_VERSION } from './electrical-adapter';
const REF='/data/circuit-templates/12v-starting-system-v2.json';
// Digest pinned from the project-authored JSON serialization of the v2 reference fixture.
const REFERENCE_MODEL_SHA256='aedda68a5f756da6369ff2cc6e0bddd667cdaa27f8562f0750285f7d75651904';
export function runLmfStartingReference(template: any, request: {modelRef:string;operatingStateId:string;testPointId:string;faultId?:string}) {
 if(request.modelRef!==REF) throw new Error('Reference model not registered');
 const states=new Set((template.operatingStates||[]).map((s:any)=>s.id));
 if(!states.has(request.operatingStateId))throw new Error('Unknown operating state');
 const point=(template.testPoints||[]).find((x:any)=>x.id===request.testPointId);
 if(!point||!point.measurementTypes.includes('voltage'))throw new Error('Voltage measurement not declared');
 const fault=request.faultId?(template.faultCatalog||[]).find((f:any)=>f.id===request.faultId):null;
 if(request.faultId&&!fault)throw new Error('Unknown fault');
 if(fault && fault.type!=='open_circuit')return {status:'unsupported-fault',measurement:null};
 // Only catalogue-declared open-circuit connection targets may enter the DC model.
 const target=fault?.targetConnectionId;
 if(fault && (!target || !(template.connections||[]).some((c:any)=>c.id===target)))
  return {status:'fault-adapter-not-connected',measurement:null};
 const result=solveWithRelayCoupling({template,modelRef:REF,operatingStateId:request.operatingStateId,
  removedElementIds:target?[target]:[],relayCouplings:(template.relayCouplings||[]) as RelayCoupling[]});
 if(!result.ok)return {status:'solver-refused',measurement:null,failure:result.failure};
 const node=result.netlist.testPointToNode[request.testPointId];
 if(!node)return {status:'measurement-unavailable',measurement:null};
 const voltage=(result.solution as MnaSuccess).nodeVoltageAbsolute[node];
 if(voltage===undefined || !Number.isFinite(voltage))return {status:'measurement-unavailable',measurement:null};
 const modelSha256=REFERENCE_MODEL_SHA256;
 const measurement=canonicalVoltageRecord({modelRef:REF,modelVersion:template.templateVersion,modelSha256,
  solverVersion:ELECTRICAL_SOLVER_VERSION,operatingStateId:request.operatingStateId,
  ...(request.faultId?{faultId:request.faultId}:{}),testPointId:request.testPointId,value:voltage});
 return {status:'solved',measurement,provenance:measurement.provenance};
}

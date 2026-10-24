/** Canonical LMF voltage record, following data/lmf/measurement-contract.json. */
export interface LmfVoltageRecord {
 readonly measurementId:string;
 readonly measurementType:'voltage';
 readonly sourceRole:'engineering-model-derived';
 readonly operatingStateId:string;
 readonly value:number;
 readonly unit:'V';
 readonly location:string;
 readonly faultId?:string;
 readonly provenance:{
  readonly solverId:'typescript-mna';
  readonly solverVersion:string;
  readonly modelRef:string;
  readonly modelVersion:string;
  readonly modelSha256:string;
  readonly engine:'headless-reference';
 };
}
export function canonicalVoltageRecord(input:{
 modelRef:string;modelVersion:string;modelSha256:string;
 solverVersion:string;operatingStateId:string;faultId?:string;
 testPointId:string;value:number;
}):LmfVoltageRecord {
 if(!Number.isFinite(input.value))throw new Error('Nonfinite measurement');
 if(!/^[a-f0-9]{64}$/.test(input.modelSha256))throw new Error('Invalid model content digest');
 if(!input.testPointId||!input.operatingStateId||!input.solverVersion||!input.modelVersion)throw new Error('Incomplete measurement provenance');
 const identity=[input.modelSha256,input.modelVersion,input.solverVersion,input.operatingStateId,input.faultId??'',input.testPointId,'voltage'];
 const measurementId='lmf:'+identity.map(x=>encodeURIComponent(x)).join(':');
 const provenance=Object.freeze({solverId:'typescript-mna' as const,solverVersion:input.solverVersion,modelRef:input.modelRef,
  modelVersion:input.modelVersion,modelSha256:input.modelSha256,engine:'headless-reference' as const});
 return Object.freeze({measurementId,measurementType:'voltage' as const,sourceRole:'engineering-model-derived' as const,
  operatingStateId:input.operatingStateId,value:input.value,unit:'V' as const,location:input.testPointId,
  ...(input.faultId?{faultId:input.faultId}:{}),provenance});
}

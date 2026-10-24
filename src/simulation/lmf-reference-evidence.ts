/** Deterministic, in-memory evidence/replay for the headless Starting v2 reference. */
import { runLmfStartingReference } from './lmf-reference-bridge';
type ReferenceRequest={modelRef:string;operatingStateId:string;testPointId:string;faultId?:string};
type ReferenceOutcome=ReturnType<typeof runLmfStartingReference>;
export interface ReferenceEvidence {
 readonly schemaVersion:'1.0.0';
 readonly evidenceRole:'training-reference-only';
 readonly request:Readonly<ReferenceRequest>;
 readonly outcome:ReferenceOutcome;
}
function snapshot<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
export function captureReferenceEvidence(template:unknown,request:ReferenceRequest):ReferenceEvidence {
 const copiedRequest=snapshot(request);
 const outcome=runLmfStartingReference(template,copiedRequest);
 return Object.freeze({schemaVersion:'1.0.0',evidenceRole:'training-reference-only',request:Object.freeze(copiedRequest),outcome:snapshot(outcome)});
}
export function replayReferenceEvidence(template:unknown,evidence:ReferenceEvidence) {
 if(evidence.schemaVersion!=='1.0.0'||evidence.evidenceRole!=='training-reference-only')throw Error('Unsupported evidence contract');
 if(!evidence.request||!evidence.outcome)throw Error('Incomplete evidence');
 const current=runLmfStartingReference(template,snapshot(evidence.request));
 // Compare all recorded outcome fields, including refusal and solver/model provenance.
 const canonical=(input:unknown)=>JSON.stringify(input,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
 const matches=canonical(current)===canonical(evidence.outcome);
 return Object.freeze({status:matches?'matched':'mismatch',matches,expected:snapshot(evidence.outcome),actual:snapshot(current)});
}

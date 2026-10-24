'use strict';
const {captureReferenceEvidence,replayReferenceEvidence}=require('../src/simulation/lmf-reference-evidence');
const template=require('../data/circuit-templates/12v-starting-system-v2.json');
const ref='/data/circuit-templates/12v-starting-system-v2.json';
describe('headless LMF reference evidence and deterministic replay',()=>{
 const request={modelRef:ref,operatingStateId:'crank',testPointId:'TP_BAT_POS'};
 test('captures reproducible evidence for healthy and open-feed simulations',()=>{
  for(const item of [request,{...request,faultId:'FAULT_OPEN_POWER'}]){
   const record=captureReferenceEvidence(template,item);
   expect(record.evidenceRole).toBe('training-reference-only');
   expect(record.outcome.status).toBe('solved');
   expect(replayReferenceEvidence(template,record).status).toBe('matched');
  }
 });
 test('detects tampering with a recorded value or model-provenance field',()=>{
  const record=captureReferenceEvidence(template,request);
  const edited=JSON.parse(JSON.stringify(record));
  edited.outcome.measurement.value+=0.1;
  expect(replayReferenceEvidence(template,edited).status).toBe('mismatch');
  edited.outcome.measurement.value=record.outcome.measurement.value;
  edited.outcome.measurement.provenance.modelVersion='fake';
  expect(replayReferenceEvidence(template,edited).matches).toBe(false);
 });
 test('refused fault evidence is replayable without fabricating a measurement',()=>{
  const record=captureReferenceEvidence(template,{...request,faultId:'FAULT_HIGH_RES_GROUND'});
  expect(record.outcome.measurement).toBeNull();
  expect(replayReferenceEvidence(template,record).matches).toBe(true);
 });
 test('rejects malformed or unrecognized evidence',()=>{
  const evidence=captureReferenceEvidence(template,request);
  expect(()=>replayReferenceEvidence(template,{...evidence,schemaVersion:'2.0.0'})).toThrow();
 });
});

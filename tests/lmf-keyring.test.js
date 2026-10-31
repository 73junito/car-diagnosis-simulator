const test=require('node:test');
const assert=require('node:assert/strict');
const {createEvidenceKeyring}=require('../src/lmf-runtime/evidence-keyring');
const actor='123e4567-e89b-42d3-a456-426614174000';
const record={evidenceRole:'training-reference-only'};
const keys={first:Buffer.alloc(32,1),second:Buffer.alloc(32,2)};
test('rotated key verifies earlier records',()=>{
 const old=createEvidenceKeyring({activeKeyId:'first',keys});
 const next=createEvidenceKeyring({activeKeyId:'second',keys});
 const prior=old.sign({actor,record});
 assert.equal(next.verify(prior,{actor}),true);
 const signed=next.sign({actor,record,previousHash:prior.hash});
 assert.equal(next.verify(signed,{actor,previousHash:prior.hash}),true);
 assert.equal(next.verify({...signed,keyId:'first'},{actor,previousHash:prior.hash}),false);
});

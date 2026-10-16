"use strict";
const { digest, preflight } = require("../scripts/preflight-3d-asset-publication");
const bytes = Buffer.from("glTF fixture bytes");
const hash = digest(bytes);
const manifest = {schemaVersion:"1.0.0",assetId:"demo-asset",reuseClass:"generic",
 revision:"1",provenance:{source:"project-authored"},scope:["review-lab"],
 permittedUses:["visual"],review:{status:"approved",reviewer:"reuse-author",evidence:"review-1"}};
const register = {schemaVersion:"1.0.0",sources:[{id:"src-1",kind:"manufacturer-page"}],
 assetReviews:[{id:"demo-asset",sourceIds:["src-1"],status:"approved",
 technicalReviewer:"engineer",reviewEvidence:"engineering-review",geometryGaps:[]}]};
const request = {use:"visual",application:"review-lab",sourceRevision:"1"};
const authorization = {assetId:"demo-asset",assetRevision:"1",application:"review-lab",use:"visual",
 status:"approved",reviewer:"publisher",evidence:"approval-1",reviewedAt:"2026-10-16",
 rightsStatus:"cleared",accessibilityStatus:"passed",performanceStatus:"passed",assetSha256:hash};
const clone = value => JSON.parse(JSON.stringify(value));
const input = () => ({register:clone(register),manifest:clone(manifest),
 request:clone(request),authorization:clone(authorization),
 assetBytes:Buffer.from(bytes),expectedAssetDigest:hash,trustedApproval:true});
test("digest matches expected bytes",()=>expect(digest(bytes)).toBe(hash));
test("positive decision requires all governance, digest and trusted caller",()=>{
 expect(preflight(input()).publishAuthorized).toBe(true);
});
test.each([
 ["default missing trust",x=>delete x.trustedApproval],
 ["untrusted caller",x=>x.trustedApproval=false],
 ["mutated bytes",x=>x.assetBytes=Buffer.from("tampered")],
 ["wrong digest",x=>x.expectedAssetDigest="0".repeat(64)],
 ["missing bound authorization hash",x=>delete x.authorization.assetSha256],
 ["missing bytes",x=>x.assetBytes=Buffer.alloc(0)],
 ["invalid hash",x=>x.expectedAssetDigest="bad"],
 ["wrong asset revision",x=>x.authorization.assetRevision="2"],
 ["unapproved technical review",x=>x.register.assetReviews[0].status="pending"],
 ["unapproved reuse",x=>x.manifest.review.status="pending"],
 ["uncleared rights",x=>x.authorization.rightsStatus="pending"]
])("%s cannot authorize publication",(_name,mutate)=>{
 const x=input();mutate(x);expect(preflight(x).publishAuthorized).toBe(false);
});

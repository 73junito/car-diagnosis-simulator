"use strict";
const { evaluatePublication: check } = require("../scripts/check-3d-publication-gate");
const copy = value => JSON.parse(JSON.stringify(value));
const manifest = {
 schemaVersion:"1.0.0", assetId:"asset-1", reuseClass:"generic", revision:"1",
 provenance:{source:"original author"}, scope:["review-lab"],
 permittedUses:["visual"], review:{status:"approved",reviewer:"reuse reviewer",evidence:"reuse-log-1"}
};
const request = {use:"visual",application:"review-lab",sourceRevision:"1"};
const register = {
 schemaVersion:"1.0.0",
 sources:[{id:"manufacturer-source",publisher:"Example",claims:[]}],
 assetReviews:[{id:"asset-1",sourceIds:["manufacturer-source"],status:"approved",
  technicalReviewer:"engineer",reviewEvidence:"tech-review-1",geometryGaps:[]}]
};
const authorization = {
 assetId:"asset-1",assetRevision:"1",application:"review-lab",use:"visual",
 status:"approved",reviewer:"publisher",evidence:"publish-review-1",reviewedAt:"2026-10-16",
 rightsStatus:"cleared",accessibilityStatus:"passed",performanceStatus:"passed"
};
const input = () => ({manifest:copy(manifest),request:copy(request),register:copy(register),authorization:copy(authorization)});
test("complete matching independent signoffs permit visual publication",()=>{
 expect(check(input()).publishAuthorized).toBe(true);
});
test.each([
 ["missing asset evidence", x=>x.register.assetReviews=[]],
 ["unknown source id",x=>x.register.assetReviews[0].sourceIds=["unknown"]],
 ["unresolved engineering gaps",x=>x.register.assetReviews[0].geometryGaps=["unknown mount"]],
 ["review only",x=>x.register.assetReviews[0].status="review-only"],
 ["pending reuse approval",x=>x.manifest.review.status="pending"],
 ["wrong manifest revision",x=>x.authorization.assetRevision="2"],
 ["wrong application",x=>x.authorization.application="another-lab"],
 ["missing publication authorization",x=>delete x.authorization],
 ["same technical and publication reviewer",x=>x.authorization.reviewer="engineer"],
 ["uncleared rights",x=>x.authorization.rightsStatus="pending"],
 ["accessibility unverified",x=>x.authorization.accessibilityStatus="pending"],
 ["performance unverified",x=>x.authorization.performanceStatus="pending"],
 ["restricted assessment",x=>x.request.use="assessment"],
 ["restricted simulation",x=>x.request.use="simulation"],
 ["invalid source register",x=>x.register.sources=null]
])("%s is fail-closed",(_name,mutate)=>{
 const x=input();mutate(x);expect(check(x).publishAuthorized).toBe(false);
});
test("real existing pending bracket and evidence register remain blocked",()=>{
 const realManifest=require("../data/component-reuse/actuator-bracket-example.json");
 const realRegister=require("../data/engineering-evidence/lab-source-register.json");
 const result=check({register:realRegister,manifest:realManifest,request,
   authorization});
 expect(result.decision).toBe("blocked");
});

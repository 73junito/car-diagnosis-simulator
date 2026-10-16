"use strict";
const reg=require("../data/engineering-evidence/lab-source-register.json");
test("all seven lab families are inventoried",()=>expect(new Set(reg.labs.map(x=>x.id)).size).toBe(7));
test("model-specific Bosch dimensions retain model provenance",()=>{const b=reg.sources.find(x=>x.id==="bosch-b3-motorsport-web");expect(b.claims.filter(x=>x.value===136||x.value===117).every(x=>x.model==="B3 LIN"&&x.status==="verified-model-specific")).toBe(true)});
test("generic alternator remains review only with geometry gaps",()=>{const a=reg.assetReviews[0];expect(a.status).toBe("review-only");expect(a.geometryGaps.length).toBeGreaterThan(2)});
test("DENSO content stays reference only",()=>{const d=reg.sources.find(x=>x.id==="denso-starter-alternator-local");expect(d.license).toMatch(/no reproduction/);expect(d.claims.every(c=>!!c.pages)).toBe(true)});
test("no source-backed publication claim is asserted",()=>expect(reg.safety.publication).toMatch(/blocked/));

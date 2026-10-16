"use strict";const data=require("../data/engineering-evidence/charging-starting-priority.json");
test("charging evidence is documented before starting",()=>expect(data.components.map(x=>x.family)).toEqual(["charging","charging","starting"]));
test("all numeric values belong to named sources, not generic GLB",()=>{for(const c of data.components){expect(c.referenceModel).toBeTruthy();expect(c.source.url).toMatch(/^https:/);expect(c.geometryApproval).toBe("pending");expect(c.electricalAuthority).toBe(false)}});
test("no model geometry or measurements are approved",()=>expect(data.components.every(x=>x.geometryApproval!=="pass"&&x.electricalAuthority===false)).toBe(true));

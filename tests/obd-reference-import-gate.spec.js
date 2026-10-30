'use strict';
const {inspect}=require('../scripts/validate-obd-reference-import');
const register=require('../data/obd2/obd-source-register.json');
const sample={protocol:'OBD_I',code:'13',sourceId:'obdcodex-ford-obd1',page:2,manufacturer:'Ford',model:'example',yearFrom:1990,yearTo:1990,description:'Provisional reference only',rightsVerified:true,technicalVerified:true};
test('all four user-supplied PDFs are source-only and rights pending',()=>{
 expect(register.documents).toHaveLength(4);
 expect(register.documents.every(d=>d.license==='not_verified'&&d.decision==='reference_only')).toBe(true);
 expect(register.importPolicy.productionWritesAllowed).toBe(false);
});
test('even caller-claimed verified record cannot bypass PDF source permissions',()=>{
 const result=inspect([sample]);expect(result.acceptedCount).toBe(0);expect(result.productionWritesAllowed).toBe(false);
 expect(result.issues[0].reasons).toContain('source_not_approved');
});
test('missing vehicle scope and page trigger review',()=>{
 const result=inspect([{...sample,page:200,manufacturer:'',model:'',yearFrom:1999,yearTo:1988,rightsVerified:false,technicalVerified:false}]);
 expect(result.issues[0].reasons).toEqual(expect.arrayContaining(['page_invalid','vehicle_applicability_missing','year_range_invalid','rights_not_verified','technical_verification_missing']));
});
test('duplicate code with identical applicability is detected, not silently overwritten',()=>{
 const result=inspect([sample,{...sample,description:'Alternate meaning'}]);
 expect(result.issues.some(e=>e.reasons.includes('potential_duplicate_or_context_collision'))).toBe(true);
});
test('Ford and GM OBD-I code are separate keys, OBD-II cannot borrow OBD-I source',()=>{
 const result=inspect([sample,{...sample,sourceId:'obdcodex-gm-obd1',manufacturer:'GM'},{...sample,protocol:'OBD_II'}]);
 expect(result.issues[0].reasons).not.toContain('potential_duplicate_or_context_collision');
 expect(result.issues[1].reasons).not.toContain('potential_duplicate_or_context_collision');
 expect(result.issues[2].reasons).toContain('source_protocol_mismatch');
});

test('generic OBD-II context is not a fabricated vehicle-specific mapping',()=>{
 const result=inspect([{...sample,protocol:'OBD_II',scope:'generic',manufacturer:'generic',model:'unspecified',yearFrom:null,yearTo:null}]);
 expect(result.issues.flatMap(issue=>issue.reasons)).not.toContain('vehicle_applicability_missing');
 expect(result.issues.flatMap(issue=>issue.reasons)).not.toContain('year_range_invalid');
 expect(result.acceptedCount).toBe(0);
 expect(result.productionWritesAllowed).toBe(false);
});
test('generic scope is rejected if vehicle fields are claimed',()=>{
 const result=inspect([{...sample,protocol:'OBD_II',scope:'generic'}]);
 expect(result.issues.flatMap(issue=>issue.reasons)).toContain('generic_scope_invalid');
});

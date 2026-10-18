'use strict';
const matrix=require('../data/curriculum/aut250-outcome-alignment-matrix.json');
const competency=require('../data/curriculum/competencies.json');
const catalog=require('../data/curriculum/course-catalog.json');
const entries=x=>Array.isArray(x)?x:Object.values(x).filter(Array.isArray).flat();
test('links to actual planned AUT-250 catalog and competency',()=>{
 const courses=entries(catalog);
 const competencies=entries(competency);
 expect(courses.find(c=>c.id===matrix.courseId).title).toBe(matrix.courseTitle);
 expect(competencies.find(c=>c.id===matrix.competencyMapping.id).courseId).toBe(matrix.courseId);
});
test('each outcome assessment links an action, activity, evidence and evaluation',()=>{
 expect(matrix.rows.length).toBeGreaterThanOrEqual(5);
 for(const row of matrix.rows)for(const k of ['criterion','studentAction','activity','evidence','evaluation'])expect(row[k].length).toBeGreaterThan(k==='criterion'?2:12);
});
test('industry crosswalk and all release gates stay pending',()=>{
 expect(matrix.externalStandards.every(s=>s.status!=='verified')).toBe(true);
 expect(Object.values(matrix.releaseGates).every(x=>x===false)).toBe(true);
 expect(matrix.scenario.assessmentEligible).toBe(false);
});
test('fictional scenario makes no unverifiable manufacturer claim',()=>{
 expect(matrix.outcome.manufacturerSpecsRequiredWhenClaimed).toBe(true);
 expect(matrix.scenario.evidenceAuthority).toBe('not_manufacturer_verified');
 expect(matrix.rubric.automaticGrading).toBe(false);
 expect(matrix.rubric.proficiencyThreshold).toBeNull();
});

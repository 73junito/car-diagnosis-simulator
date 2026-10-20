'use strict';
const data=require('../data/curriculum/aut250-weekly-lab-blueprint.json');
const labs=data.weeklyLabs;
test('AUT 250 course retains planned 15 weeks and thirty virtual laboratory hours',()=>{
 expect(data.courseId).toBe('aut-250');
 expect(data.weeks).toBe(15);expect(data.credits).toBe(3);
 expect(labs).toHaveLength(15);expect(labs.reduce((n,l)=>n+l.durationMinutes,0)).toBe(1800);
 expect(labs.map(l=>l.week)).toEqual(Array.from({length:15},(_,i)=>i+1));
 expect(new Set(labs.map(l=>l.id)).size).toBe(15);
});
test('lab workflow totals 120 minutes, evidence and instructor materials present',()=>{
 for(const lab of labs){
  expect(Object.values(lab.sessionMinutes).reduce((a,b)=>a+b,0)).toBe(120);
  expect(lab.requiredSections).toEqual(expect.arrayContaining(['safety_briefing','interactive_diagnostic_scenario','student_evidence_worksheet','instructor_reference_and_feedback','accessibility_notes','source_and_measurement_provenance','technical_review_checklist']));
  expect(lab.evidenceRequirements).toEqual(expect.arrayContaining(['competing_hypotheses','test_selection_justification','repair_verification_plan']));
 }
});
test('no lab, capstone or written final becomes graded or published by configuration',()=>{
 expect(data.writtenFinal).toMatchObject({questionCount:50,examDeliveryEnabled:false,automaticScoringEnabled:false});
 expect(data.practicalCapstone).toMatchObject({week:15,instructorReviewed:true,automaticScoringEnabled:false});
 for(const lab of labs)expect(lab).toMatchObject({smeApproved:false,rightsApproved:false,assessmentEligible:false,autoGradingEnabled:false,published:false});
 expect(data.restrictions.noProductionWrites).toBe(true);
});
test('OBD-I, OBD-II, electrical, scope and comprehensive labs are represented',()=>{
 expect(labs[2].title).toMatch(/OBD-I/);
 expect(labs[3].title).toMatch(/OBD-II/);
 expect(labs[5].title).toMatch(/Ohm/);
 expect(labs[8].title).toMatch(/Oscilloscope/);
 expect(labs[14].title).toMatch(/capstone/);
});

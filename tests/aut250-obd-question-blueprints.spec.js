'use strict';
const data=require('../data/curriculum/aut250-obd-question-blueprints.json');
const {validate}=require('../scripts/validate-obd-question-blueprints');
test('developmental blueprint has traceable curriculum IDs and locked assessment',()=>{expect(validate()).toMatchObject({valid:true,assessmentEligible:false});expect(data.questions).toHaveLength(3)});
test('invalid answer key and duplicate IDs fail closed',()=>{const c=JSON.parse(JSON.stringify(data));c.questions[1].id=c.questions[0].id;c.questions[0].correctChoiceId='missing';const r=validate(c);expect(r.valid).toBe(false);expect(r.errors).toContain('choices_invalid:0');expect(r.errors).toContain('duplicate_or_missing_id:1')});
test('unapproved assessment and missing source page fail',()=>{const c=JSON.parse(JSON.stringify(data));c.review.productionAssessmentAllowed=true;c.questions[0].sourceContext[0].page=0;expect(validate(c).errors).toEqual(expect.arrayContaining(['authority_not_closed','source_locator_invalid:0']))});
test('no immediate replacement or invented OEM numerical verdict in answer rationales',()=>{expect(data.questions.every(x=>x.technicalStatus==='pending_sme'&&x.assessmentEligible===false)).toBe(true);expect(data.questions.find(x=>x.id.endsWith('003')).expectedEvidence).toContain('no manufacturer specification supplied')});

'use strict';

const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function canonical(value){
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function canonicalHash(value){return sha256(Buffer.from(canonical(value),'utf8'));}

const expected={
  'charging-system-formative-draft-05-001':{
    claim:'charging-system-challenge-claim-05',
    stem:'Which statement best describes lead-acid battery charging behavior?',
    answer:'A',
    answerText:'Charging behavior depends on state of charge and the charger or regulator strategy.'
  },
  'charging-system-formative-draft-07-001':{
    claim:'charging-system-challenge-claim-07',
    stem:'During constant-voltage charging of a discharged lead-acid battery, which current trend is most consistent with the approved instructional concept?',
    answer:'B',
    answerText:'Charging current may be high initially and then decrease as battery voltage rises toward full charge.'
  },
  'charging-system-formative-draft-08-001':{
    claim:'charging-system-challenge-claim-08',
    stem:'Why can increased electrical charging demand increase mechanical load on an engine with a belt-driven charging system?',
    answer:'A',
    answerText:'The charging system converts additional mechanical input into electrical output, so greater electrical demand can require more mechanical power from the engine.'
  }
};

function validate(options={}){
  const root=path.resolve(__dirname,'..');
  const sourcePath=options.sourcePath||path.join(root,'data','evidence','review-queues','charging-system-formative-question-drafts-20261003.json');
  const resultPath=options.resultPath||path.join(root,'data','evidence','validation-results','charging-system-formative-question-drafts-deterministic-validation-20261004.json');
  const finalPath=options.finalPath||path.join(root,'data','evidence','review-queues','charging-system-final-approval-decisions-20261003.json');
  const sourceBytes=fs.readFileSync(sourcePath);
  const source=JSON.parse(sourceBytes.toString('utf8'));
  const result=readJson(resultPath);
  const final=readJson(finalPath);
  const errors=[];

  if(result.artifact_type!=='deterministic-formative-item-validation') errors.push('artifact_type mismatch');
  if(result.validator_version!=='charging-system-formative-item-validator-1.0') errors.push('validator_version mismatch');
  if(result.validation_type!=='deterministic-exact-payload-contract') errors.push('validation_type mismatch');
  if(result.source_artifact_sha256!==sha256(sourceBytes)) errors.push('source artifact hash mismatch');
  if(result.scope?.question_count!==3) errors.push('validation scope question_count must be 3');

  const finalBy=new Map(final.decisions.map(r=>[r.claim_id,r]));
  const sourceBy=new Map(source.questions.map(q=>[q.id,q]));
  const resultBy=new Map((result.items||[]).map(i=>[i.id,i]));
  if(source.questions.length!==3) errors.push('source must contain exactly 3 questions');
  if(result.items.length!==3) errors.push('result must contain exactly 3 item validations');

  for(const [id,e] of Object.entries(expected)){
    const q=sourceBy.get(id);
    const v=resultBy.get(id);
    if(!q){errors.push(id+': missing source item');continue;}
    if(!v){errors.push(id+': missing validation result');continue;}
    if(q.claim_id!==e.claim) errors.push(id+': claim mismatch');
    if(v.claim_id!==e.claim) errors.push(id+': result claim mismatch');
    if(q.stem!==e.stem) errors.push(id+': exact stem mismatch');
    if(q.answer!==e.answer) errors.push(id+': answer key mismatch');
    if(q.choices?.[q.answer]!==e.answerText) errors.push(id+': keyed answer text mismatch');
    const choices=Object.values(q.choices||{});
    if(Object.keys(q.choices||{}).join(',')!=='A,B,C,D') errors.push(id+': choices must be A-D');
    if(new Set(choices).size!==4) errors.push(id+': choices must be unique');
    if(!q.explanation||q.explanation.trim().length<40) errors.push(id+': explanation missing');

    const f=finalBy.get(q.claim_id);
    if(!f||q.source_final_content_text!==f.final_content_text) errors.push(id+': final content provenance mismatch');

    if(v.canonical_item_sha256!==canonicalHash(q)) errors.push(id+': canonical item hash mismatch');
    if(v.result!=='valid') errors.push(id+': result must be valid');
    if(Object.values(v.checks||{}).some(x=>x!==true)) errors.push(id+': all recorded checks must be true');

    const joined=[q.stem,...choices,q.explanation].join(' ');
    if(/\b\d+(?:\.\d+)?\s*(?:V|A|amp|amps|amperes?|volt|volts|percent|%)\b/i.test(joined)) errors.push(id+': numeric threshold/value detected');

    for(const field of ['scored','assessmentEligible','institutionalAssessmentEligible','highStakesEligible','productionAssessmentApiEligible','productionRelease','assessmentRelease','autoApproval']){
      if(q[field]!==false) errors.push(id+': '+field+' must remain false');
    }
    if(q.status!=='draft-pending-item-level-review') errors.push(id+': draft status changed');
    if(q.deliveryMode!=='formative-draft') errors.push(id+': delivery mode changed');
    const g=q.item_level_governance||{};
    if(g.rights_review!=='pending-item-level-confirmation') errors.push(id+': rights review must remain pending');
    for(const field of ['technical_review','instructional_review','safety_review','deterministic_item_validation','human_item_approval']){
      if(g[field]!=='pending') errors.push(id+': source governance '+field+' must remain pending');
    }
  }

  const s=result.summary||{};
  if(s.questions_validated!==3||s.questions_valid!==3||s.questions_invalid!==0) errors.push('validation summary counts invalid');
  for(const field of ['human_item_approvals_recorded','scored_count','assessment_eligible_count','production_release_count']){
    if(s[field]!==0) errors.push('summary.'+field+' must remain 0');
  }
  const p=result.post_validation_state||{};
  if(p.deterministic_validation_result!=='valid-for-exact-hashed-payloads') errors.push('post-validation result mismatch');
  for(const field of ['human_technical_review','human_instructional_review','human_safety_review','item_level_rights_confirmation','human_item_approval']){
    if(p[field]!=='pending') errors.push('post-validation '+field+' must remain pending');
  }
  for(const field of ['assessment_eligibility','scoring_authority','production_release']){
    if(p[field]!==false) errors.push('post-validation '+field+' must remain false');
  }
  const blocked=(result.blocked_claims||[]).map(x=>x.claim_id).sort();
  if(JSON.stringify(blocked)!==JSON.stringify(['charging-system-challenge-claim-02','charging-system-challenge-claim-12'])) errors.push('blocked claims must remain 02 and 12');

  return {errors,source,result};
}

function formatSummary(s){
  return [
    'questions_validated: '+s.questions_validated,
    'questions_valid: '+s.questions_valid,
    'questions_invalid: '+s.questions_invalid,
    'human_item_approvals_recorded: '+s.human_item_approvals_recorded,
    'scored_count: '+s.scored_count,
    'assessment_eligible_count: '+s.assessment_eligible_count,
    'production_release_count: '+s.production_release_count
  ].join('\n');
}

if(require.main===module){
  const r=validate();
  console.log(formatSummary(r.result.summary));
  if(r.errors.length){r.errors.forEach(e=>console.error('FAIL: '+e));process.exitCode=1;}
  else console.log('PASS: exact charging-system formative item payloads validate deterministically and remain fail-closed.');
}

module.exports={validate,formatSummary,canonicalHash};
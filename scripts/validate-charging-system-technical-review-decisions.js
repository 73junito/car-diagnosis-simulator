const fs = require('fs');
const path = require('path');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function validate(options = {}) {
  const root = path.resolve(__dirname, '..');
  const decisionPath = options.decisionPath || path.join(root,'data','evidence','review-queues','charging-system-technical-review-decisions-20261003.json');
  const prepPath = options.prepPath || path.join(root,'data','evidence','review-queues','charging-system-technical-review-prep-20261003.json');
  const decisions = readJson(decisionPath);
  const prep = readJson(prepPath);
  const errors = [];

  if (decisions.artifact_type !== 'human-technical-review-decisions') errors.push('artifact_type mismatch');
  if (decisions.stage !== 'technical-review-complete-pending-citation-validation') errors.push('stage mismatch');

  const prepById = new Map(prep.reviews.map((r)=>[r.claim_id,r]));
  const rows = decisions.reviews || [];
  if (rows.length !== prep.reviews.length) errors.push('decision count must match prepared review count');

  let caveat=0, revision=0;
  for (const row of rows) {
    const prepared = prepById.get(row.claim_id);
    if (!prepared) { errors.push(row.claim_id + ': not in prep'); continue; }
    if (row.original_claim_text !== prepared.claim_text) errors.push(row.claim_id + ': original_claim_text mismatch');
    if (row.reviewer_identity !== 'Rafael Rodriguez Jr.') errors.push(row.claim_id + ': reviewer_identity mismatch');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.reviewed_at || '')) errors.push(row.claim_id + ': reviewed_at invalid');
    if (row.technical_decision === 'approved-with-caveat') {
      caveat += 1;
      if (row.approved_claim_text !== row.original_claim_text) errors.push(row.claim_id + ': caveat approval must preserve text');
      if (!row.required_caveat) errors.push(row.claim_id + ': required_caveat missing');
    } else if (row.technical_decision === 'approved-with-revision') {
      revision += 1;
      if (!row.approved_claim_text || row.approved_claim_text === row.original_claim_text) errors.push(row.claim_id + ': revision must change text');
      if (row.required_caveat !== null) errors.push(row.claim_id + ': revised claim should not carry prepared caveat field');
    } else {
      errors.push(row.claim_id + ': invalid technical_decision');
    }
    for (const field of ['citation_validation_status','instructional_review_status','approval_status']) {
      if (row[field] !== 'pending') errors.push(row.claim_id + ': ' + field + ' must remain pending');
    }
    if (row.assessment_eligible !== false) errors.push(row.claim_id + ': assessment_eligible must remain false');
  }

  const c08 = rows.find((r)=>r.claim_id==='charging-system-challenge-claim-08');
  const c12 = rows.find((r)=>r.claim_id==='charging-system-challenge-claim-12');
  if (!c08 || c08.approved_claim_text !== 'Electrical charging demand and belt-driven auxiliaries increase mechanical load on the engine.') errors.push('claim-08 revised wording mismatch');
  if (!c12 || c12.approved_claim_text !== 'If charging-system output is insufficient under the specified electrical load, system voltage may fall below the manufacturer-specified range.') errors.push('claim-12 revised wording mismatch');

  const s = decisions.summary;
  if (s.mapped_claims_in_review !== 5) errors.push('summary mapped count must be 5');
  if (s.human_technical_decisions_recorded !== 5) errors.push('summary human decisions must be 5');
  if (s.approved_with_caveat !== caveat) errors.push('summary caveat count mismatch');
  if (s.approved_with_revision !== revision) errors.push('summary revision count mismatch');
  if (s.technical_reviewed_count !== 5) errors.push('technical_reviewed_count must be 5');
  for (const field of ['citation_validated_count','instructional_reviewed_count','approved_count','assessment_eligible_count']) {
    if (s[field] !== 0) errors.push('summary.' + field + ' must remain 0');
  }
  return { errors, decisions };
}

function formatSummary(s) {
  return [
    'mapped_claims_in_review: ' + s.mapped_claims_in_review,
    'human_technical_decisions_recorded: ' + s.human_technical_decisions_recorded,
    'approved_with_caveat: ' + s.approved_with_caveat,
    'approved_with_revision: ' + s.approved_with_revision,
    'technical_reviewed_count: ' + s.technical_reviewed_count,
    'citation_validated_count: ' + s.citation_validated_count,
    'instructional_reviewed_count: ' + s.instructional_reviewed_count,
    'approved_count: ' + s.approved_count,
    'assessment_eligible_count: ' + s.assessment_eligible_count
  ].join('\n');
}

if (require.main === module) {
  const result = validate();
  console.log(formatSummary(result.decisions.summary));
  if (result.errors.length) {
    result.errors.forEach((e)=>console.error('FAIL: '+e));
    process.exitCode=1;
  } else {
    console.log('PASS: charging-system human technical decisions validate fail-closed.');
  }
}
module.exports={validate,formatSummary};

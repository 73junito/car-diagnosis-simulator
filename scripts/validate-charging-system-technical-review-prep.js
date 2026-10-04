const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function validate(options = {}) {
  const root = path.resolve(__dirname, '..');
  const prepPath = options.prepPath || path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-technical-review-prep-20261003.json');
  const mappingPath = options.mappingPath || path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-claim-source-mapping-20261003.json');
  const prep = readJson(prepPath);
  const mapping = readJson(mappingPath);
  const errors = [];

  if (prep.artifact_type !== 'technical-review-preparation') errors.push('artifact_type must be technical-review-preparation');
  if (prep.stage !== 'recommendations-awaiting-named-human-review') errors.push('stage must remain recommendations-awaiting-named-human-review');

  const mappedIds = mapping.mappings
    .filter((r) => r.mapping_status === 'mapped-pending-technical-review')
    .map((r) => r.claim_id);
  const reviewIds = (prep.reviews || []).map((r) => r.claim_id);

  if (reviewIds.length !== mappedIds.length) errors.push('prep must cover every mapped claim exactly once');
  if (new Set(reviewIds).size !== reviewIds.length) errors.push('duplicate claim_id in technical review prep');
  for (const id of mappedIds) if (!reviewIds.includes(id)) errors.push('missing mapped claim in prep: ' + id);

  let support = 0;
  let revise = 0;
  for (const row of prep.reviews || []) {
    if (row.review_status !== 'pending-human-technical-review') errors.push(row.claim_id + ': review_status must remain pending-human-technical-review');
    if (row.reviewer_identity !== null) errors.push(row.claim_id + ': reviewer_identity must remain null');
    if (row.reviewed_at !== null) errors.push(row.claim_id + ': reviewed_at must remain null');
    if (row.recommended_disposition === 'support-with-caveat') support += 1;
    else if (row.recommended_disposition === 'revise-before-technical-approval') revise += 1;
    else errors.push(row.claim_id + ': invalid recommended_disposition');

    if (!Array.isArray(row.locator_findings) || row.locator_findings.length === 0) errors.push(row.claim_id + ': locator_findings required');
    if (!row.technical_finding) errors.push(row.claim_id + ': technical_finding required');

    for (const field of ['citation_validation_status','instructional_review_status','approval_status']) {
      if (row[field] !== 'pending') errors.push(row.claim_id + ': ' + field + ' must remain pending');
    }
    if (row.assessment_eligible !== false) errors.push(row.claim_id + ': assessment_eligible must remain false');
  }

  if (prep.summary.mapped_claims_reviewed_for_preparation !== mappedIds.length) errors.push('summary mapped prep count mismatch');
  if (prep.summary.recommended_support_with_caveat !== support) errors.push('summary support count mismatch');
  if (prep.summary.recommended_revision_before_technical_approval !== revise) errors.push('summary revise count mismatch');
  for (const field of ['human_technical_decisions_recorded','technical_reviewed_count','citation_validated_count','instructional_reviewed_count','approved_count','assessment_eligible_count']) {
    if (prep.summary[field] !== 0) errors.push('summary.' + field + ' must remain 0');
  }

  const claim08 = prep.reviews.find((r) => r.claim_id === 'charging-system-challenge-claim-08');
  const claim12 = prep.reviews.find((r) => r.claim_id === 'charging-system-challenge-claim-12');
  if (!claim08 || claim08.recommended_disposition !== 'revise-before-technical-approval') errors.push('claim-08 must require revision');
  if (!claim12 || claim12.recommended_disposition !== 'revise-before-technical-approval') errors.push('claim-12 must require revision');

  return { errors, prep };
}

function formatSummary(summary) {
  return [
    'mapped_claims_reviewed_for_preparation: ' + summary.mapped_claims_reviewed_for_preparation,
    'recommended_support_with_caveat: ' + summary.recommended_support_with_caveat,
    'recommended_revision_before_technical_approval: ' + summary.recommended_revision_before_technical_approval,
    'human_technical_decisions_recorded: ' + summary.human_technical_decisions_recorded,
    'technical_reviewed_count: ' + summary.technical_reviewed_count,
    'citation_validated_count: ' + summary.citation_validated_count,
    'instructional_reviewed_count: ' + summary.instructional_reviewed_count,
    'approved_count: ' + summary.approved_count,
    'assessment_eligible_count: ' + summary.assessment_eligible_count
  ].join('\n');
}

if (require.main === module) {
  const result = validate();
  console.log(formatSummary(result.prep.summary));
  if (result.errors.length) {
    result.errors.forEach((e) => console.error('FAIL: ' + e));
    process.exitCode = 1;
  } else {
    console.log('PASS: charging-system technical-review preparation remains fail-closed.');
  }
}

module.exports = { validate, formatSummary };

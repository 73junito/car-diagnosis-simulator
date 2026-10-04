const fs = require('fs');
const path = require('path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateChargingSystemClaimSourceMapping(options = {}) {
  const root = path.resolve(__dirname, '..');
  const mappingPath = options.mappingPath || path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-claim-source-mapping-20261003.json');
  const manifestPath = options.manifestPath || path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-challenge-candidate-source-manifest-20261003.json');
  const rightsPath = options.rightsPath || path.join(root, 'data', 'evidence', 'review-queues', 'charging-system-rights-review-records-20261003.json');

  const mapping = readJson(mappingPath);
  const manifest = readJson(manifestPath);
  const rights = readJson(rightsPath);
  const errors = [];

  if (mapping.artifact_type !== 'claim-to-source-mapping') errors.push('artifact_type must be claim-to-source-mapping');
  if (mapping.scenario_id !== 'charging-system') errors.push('scenario_id must be charging-system');

  const manifestClaims = new Map(manifest.claim_candidates.map((row) => [row.claim_id, row]));
  const rightsById = new Map(rights.reviews.map((row) => [row.candidate_id, row]));
  const rows = mapping.mappings || [];
  const ids = rows.map((row) => row.claim_id);

  if (rows.length !== manifest.claim_candidates.length) errors.push('mapping must cover all ' + manifest.claim_candidates.length + ' discovery claims');
  if (new Set(ids).size !== ids.length) errors.push('mapping contains duplicate claim_id values');
  for (const claimId of manifestClaims.keys()) {
    if (!ids.includes(claimId)) errors.push('missing mapping row for ' + claimId);
  }

  let mappedCount = 0;
  let unmappedCount = 0;
  for (const row of rows) {
    const discovered = manifestClaims.get(row.claim_id);
    if (!discovered) {
      errors.push(row.claim_id + ': not present in candidate-source manifest');
      continue;
    }
    if (row.claim_text !== discovered.claim_text) errors.push(row.claim_id + ': claim_text must match discovery manifest exactly');

    const mapped = row.mapping_status === 'mapped-pending-technical-review';
    const unmapped = typeof row.mapping_status === 'string' && row.mapping_status.startsWith('unmapped-');
    if (!mapped && !unmapped) errors.push(row.claim_id + ': invalid mapping_status');
    if (mapped) mappedCount += 1;
    if (unmapped) unmappedCount += 1;

    if (mapped && (!Array.isArray(row.mapped_sources) || row.mapped_sources.length === 0)) errors.push(row.claim_id + ': mapped claim requires mapped_sources');
    if (unmapped && Array.isArray(row.mapped_sources) && row.mapped_sources.length !== 0) errors.push(row.claim_id + ': unmapped claim must not carry mapped_sources');

    const candidates = new Map((discovered.candidates || []).map((c) => [c.candidate_id, c]));
    for (const source of row.mapped_sources || []) {
      const candidate = candidates.get(source.candidate_id);
      if (!candidate) {
        errors.push(row.claim_id + ': ' + source.candidate_id + ' was not a discovery candidate for this claim');
        continue;
      }
      if (source.locator !== candidate.locator) errors.push(row.claim_id + ': locator for ' + source.candidate_id + ' must match discovery manifest');
      const rightsRow = rightsById.get(source.candidate_id);
      if (!rightsRow || rightsRow.rights_decision === 'pending') {
        errors.push(row.claim_id + ': ' + source.candidate_id + ' lacks completed rights review');
      } else if (source.rights_decision !== rightsRow.rights_decision) {
        errors.push(row.claim_id + ': rights_decision for ' + source.candidate_id + ' must match rights-review record');
      }
      if (source.locator_verification !== 'pending-human-technical-review') errors.push(row.claim_id + ': locator_verification must remain pending-human-technical-review');
    }

    const pendingFields = ['technical_review_status', 'citation_validation_status', 'instructional_review_status', 'approval_status'];
    for (const field of pendingFields) {
      if (row[field] !== 'pending') errors.push(row.claim_id + ': ' + field + ' must remain pending');
    }
    if (row.assessment_eligible !== false) errors.push(row.claim_id + ': assessment_eligible must remain false');

    const serialized = JSON.stringify(row);
    if (/"excerpt"|"question_payload"|"scoring_rule"\s*:/.test(serialized)) errors.push(row.claim_id + ': mapping artifact must not store excerpts, question payloads, or scoring rules');
  }

  if (mapping.summary.mapped_count !== mappedCount) errors.push('summary.mapped_count must equal ' + mappedCount);
  if (mapping.summary.unmapped_count !== unmappedCount) errors.push('summary.unmapped_count must equal ' + unmappedCount);
  for (const field of ['citation_validated_count','technical_reviewed_count','instructional_reviewed_count','approved_count','assessment_eligible_count']) {
    if (mapping.summary[field] !== 0) errors.push('summary.' + field + ' must remain 0');
  }

  const claim13 = rows.find((row) => row.claim_id === 'charging-system-challenge-claim-13');
  if (!claim13 || !claim13.mapping_status.startsWith('unmapped-') || claim13.mapped_sources.length !== 0) errors.push('claim-13 must remain unmapped');

  return { errors, mapping };
}

function formatSummary(summary) {
  return [
    'claims_in_slice: ' + summary.claims_in_slice,
    'mapped_count: ' + summary.mapped_count,
    'unmapped_count: ' + summary.unmapped_count,
    'citation_validated_count: ' + summary.citation_validated_count,
    'technical_reviewed_count: ' + summary.technical_reviewed_count,
    'instructional_reviewed_count: ' + summary.instructional_reviewed_count,
    'approved_count: ' + summary.approved_count,
    'assessment_eligible_count: ' + summary.assessment_eligible_count
  ].join('\n');
}

if (require.main === module) {
  const result = validateChargingSystemClaimSourceMapping();
  console.log(formatSummary(result.mapping.summary));
  if (result.errors.length) {
    for (const error of result.errors) console.error('FAIL: ' + error);
    process.exitCode = 1;
  } else {
    console.log('PASS: charging-system claim-to-source mapping validates fail-closed.');
  }
}

module.exports = { validateChargingSystemClaimSourceMapping, formatSummary };

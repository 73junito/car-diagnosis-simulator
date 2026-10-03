'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(repoRoot, 'data', 'evidence', 'review-queues',
  'charging-system-challenge-candidate-source-manifest-20261003.json');
const INTAKE_PATH = path.join(repoRoot, 'evidence', 'review-queues',
  'scenario-challenge-evidence-intake-20261003.json');
const POLICY_PATH = path.join(repoRoot, 'data', 'evidence', 'open-evidence-source-policy.json');

const ZERO_SUMMARY_KEYS = [
  'mapped_count', 'citation_validated_count', 'technical_reviewed_count',
  'instructional_reviewed_count', 'approved_count', 'assessment_eligible_count'
];

const GOVERNANCE_FALSE_KEYS = [
  'claim_to_source_mapping_committed', 'rights_review_complete', 'citation_validation_complete',
  'technical_review_complete', 'instructional_review_complete', 'approval_complete',
  'training_mix_unblocked', 'scoring_unblocked', 'assessment_eligibility_changed',
  'draft_questions_modified'
];

const REQUIRED_CANDIDATE_FIELDS = [
  'candidate_id', 'title', 'author_or_issuer', 'publisher', 'canonical_url',
  'publication_or_revision_date', 'source_type', 'rights_classification_candidate',
  'rights_status', 'rights_basis', 'evidence_decision', 'permitted_project_use'
];

const PENDING_RIGHTS_PATTERN = /rights-review-required|pending|unverified|blocked|unknown/i;
const CANDIDATE_DISCOVERY_STATUS = 'candidate-identified-pending-human-rights-and-technical-review';
const GAP_DISCOVERY_STATUS = 'source-gap-discovery-continues';
const DISCOVERY_STATUSES = [CANDIDATE_DISCOVERY_STATUS, GAP_DISCOVERY_STATUS];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJson(filePath, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} could not be read from ${filePath}: ${error.message}`);
    return null;
  }
}

function normalizeClaim(text) {
  return String(text).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function validateManifest(options = {}) {
  const manifestPath = options.manifestPath || MANIFEST_PATH;
  const intakePath = options.intakePath || INTAKE_PATH;
  const policyPath = options.policyPath || POLICY_PATH;
  const errors = [];

  const manifest = readJson(manifestPath, errors, 'manifest');
  const intake = readJson(intakePath, errors, 'intake queue');
  const policy = readJson(policyPath, errors, 'source policy');
  if (errors.length > 0) return { errors, summary: null, manifest: null };

  if (manifest.artifact_type !== 'scenario-challenge-candidate-source-manifest') {
    errors.push(`artifact_type must be scenario-challenge-candidate-source-manifest; received ${manifest.artifact_type}`);
  }
  if (manifest.scenario_id !== 'charging-system') {
    errors.push(`scenario_id must be charging-system; received ${manifest.scenario_id}`);
  }
  if (manifest.stage !== 'candidate-source-discovery-only') {
    errors.push(`stage must be candidate-source-discovery-only; received ${manifest.stage}`);
  }
  if (manifest.policy !== 'data/evidence/open-evidence-source-policy.json') {
    errors.push('manifest must reference data/evidence/open-evidence-source-policy.json as its policy');
  }
  if (manifest.intake_queue !== 'evidence/review-queues/scenario-challenge-evidence-intake-20261003.json') {
    errors.push('manifest must reference the scenario-challenge intake queue as its intake queue');
  }

  const governance = manifest.governance || {};
  if (governance.source_discovery_complete_for_slice !== true) {
    errors.push('governance.source_discovery_complete_for_slice must be true for a completed discovery slice');
  }
  if (governance.database_writes !== 0) {
    errors.push(`governance.database_writes must be 0; received ${governance.database_writes}`);
  }
  for (const key of GOVERNANCE_FALSE_KEYS) {
    if (governance[key] !== false) {
      errors.push(`governance.${key} must remain false in a discovery-only manifest`);
    }
  }

  const claims = Array.isArray(manifest.claim_candidates) ? manifest.claim_candidates : null;
  if (!claims) {
    errors.push('claim_candidates must be an array');
    return { errors, summary: null, manifest };
  }
  if (claims.length < 10 || claims.length > 15) {
    errors.push(`claims_in_slice must be between 10 and 15; received ${claims.length}`);
  }
  if (!manifest.scope || manifest.scope.claims_in_slice !== claims.length) {
    errors.push(`scope.claims_in_slice must equal the ${claims.length} claim rows`);
  }
  if (!manifest.summary || manifest.summary.claims_in_slice !== claims.length) {
    errors.push(`summary.claims_in_slice must equal the ${claims.length} claim rows`);
  }

  const summary = manifest.summary || {};
  for (const key of ZERO_SUMMARY_KEYS) {
    if (summary[key] !== 0) {
      errors.push(`${key} must be 0 in a discovery-only manifest; received ${summary[key]}`);
    }
  }

  const csEntries = (intake.entries || []).filter((entry) => entry.scenario_id === 'charging-system');
  const totalIntakeClaims = csEntries.reduce(
    (count, entry) => count + (Array.isArray(entry.claims_to_verify) ? entry.claims_to_verify.length : 0),
    0
  );
  if (csEntries.length === 0) errors.push('intake queue contains no charging-system entries');
  if (claims.length > totalIntakeClaims) {
    errors.push(`manifest holds ${claims.length} claims but the intake queue only has ${totalIntakeClaims} charging-system claims`);
  }
  if (manifest.scope && manifest.scope.draft_count !== csEntries.length) {
    errors.push(`scope.draft_count must equal the ${csEntries.length} charging-system intake drafts`);
  }
  if (!intake.summary || intake.summary.mapped_count !== 0) {
    errors.push('intake queue summary.mapped_count must remain 0; discovery must not increment it');
  }
  for (const key of ZERO_SUMMARY_KEYS) {
    if (intake.summary && key in intake.summary && intake.summary[key] !== 0) {
      errors.push(`intake queue summary.${key} must remain 0`);
    }
  }
  for (const entry of csEntries) {
    const label = entry.synthetic_draft_id || 'charging-system entry';
    if (entry.mapping_status !== 'unmapped-source-discovery-required') {
      errors.push(`${label}: intake mapping_status must remain unmapped-source-discovery-required`);
    }
    if (entry.evidence_mapping_completed !== false) {
      errors.push(`${label}: intake evidence_mapping_completed must remain false`);
    }
    if (!Array.isArray(entry.candidate_sources) || entry.candidate_sources.length !== 0) {
      errors.push(`${label}: intake candidate_sources must remain empty during discovery`);
    }
  }
  const candidateIds = new Set();
  const candidates = manifest.source_candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    errors.push('source_candidates must be a non-empty array');
  } else {
    const acceptedRights = new Set((policy.accepted_rights_classifications || []));
    for (const candidate of candidates) {
      const label = candidate.candidate_id || '<candidate missing id>';
      for (const field of REQUIRED_CANDIDATE_FIELDS) {
        if (!nonEmpty(candidate[field])) errors.push(`${label}: required field ${field} must be recorded`);
      }
      if (candidateIds.has(candidate.candidate_id)) errors.push(`${label}: duplicate candidate_id`);
      candidateIds.add(candidate.candidate_id);
      if (nonEmpty(candidate.canonical_url) && !candidate.canonical_url.startsWith('https://')) {
        errors.push(`${label}: canonical_url must be an https URL`);
      }
      if (!Array.isArray(candidate.section_or_page) || candidate.section_or_page.length === 0 ||
          candidate.section_or_page.some((locator) => !nonEmpty(locator))) {
        errors.push(`${label}: section_or_page must record at least one section/page locator`);
      }
      if (!Array.isArray(candidate.observed_scope) || candidate.observed_scope.length === 0) {
        errors.push(`${label}: observed_scope must record at least one observed topic`);
      }
      if (candidate.evidence_decision !== 'candidate-only') {
        errors.push(`${label}: evidence_decision must remain candidate-only during discovery`);
      }
      if (candidate.store_verbatim_excerpt !== false) errors.push(`${label}: store_verbatim_excerpt must be false`);
      if (candidate.may_generate_questions !== false) errors.push(`${label}: may_generate_questions must be false`);
      if (candidate.approval_effect !== 'none') errors.push(`${label}: approval_effect must be none`);
      const rightsPending = PENDING_RIGHTS_PATTERN.test(String(candidate.rights_status));
      const classificationAccepted = acceptedRights.has(candidate.rights_classification_candidate);
      if (!classificationAccepted || rightsPending) {
        if (candidate.evidence_decision !== 'candidate-only') {
          errors.push(`${label}: sources with unclear reuse rights must stay candidate-only`);
        }
        if (!rightsPending) {
          errors.push(`${label}: rights_status must record rights-review-required while reuse rights are unclear`);
        }
        if (candidate.store_verbatim_excerpt !== false) {
          errors.push(`${label}: sources with unclear reuse rights must not store verbatim excerpts`);
        }
      }
      if (!rightsPending && !nonEmpty(candidate.rights_reference)) {
        errors.push(`${label}: a non-pending rights_status must cite a rights_reference`);
      }
    }
    if (summary.candidate_sources_discovered !== candidates.length) {
      errors.push(`summary.candidate_sources_discovered must equal ${candidates.length}; received ${summary.candidate_sources_discovered}`);
    }
  }

  const claimIds = new Set();
  for (const row of claims) {
    const label = row.claim_id || '<claim missing id>';
    if (!nonEmpty(row.claim_id)) errors.push('every claim row must record a claim_id');
    else if (claimIds.has(row.claim_id)) errors.push(`${label}: duplicate claim_id`);
    else claimIds.add(row.claim_id);
    if (!DISCOVERY_STATUSES.includes(row.discovery_status)) {
      errors.push(`${label}: discovery_status must be a discovery-only status`);
    }
    if (row.mapping_committed !== false) errors.push(`${label}: mapping_committed must be false`);
    const draft = csEntries.find((entry) => entry.synthetic_draft_id === row.draft_id);
    if (!draft) {
      errors.push(`${label}: draft_id not found among charging-system intake entries`);
      continue;
    }
    const intakeClaim = (draft.claims_to_verify || [])[row.claim_index];
    if (intakeClaim === undefined) {
      errors.push(`${label}: claim_index ${row.claim_index} is out of range for ${row.draft_id}`);
      continue;
    }
    if (normalizeClaim(intakeClaim) !== normalizeClaim(row.claim_text)) {
      errors.push(`${label}: claim_text does not match the intake queue claim`);
    }
    const refs = Array.isArray(row.candidates) ? row.candidates : [];
    if (refs.length === 0 && row.discovery_status !== GAP_DISCOVERY_STATUS) {
      errors.push(`${label}: rows without candidates must use the source-gap discovery status`);
    }
    if (refs.length > 0 && row.discovery_status !== CANDIDATE_DISCOVERY_STATUS) {
      errors.push(`${label}: rows with candidates must use the candidate-identified discovery status`);
    }
    for (const ref of refs) {
      if (!candidateIds.has(ref.candidate_id)) errors.push(`${label}: unknown candidate_id ${ref.candidate_id}`);
      if (!nonEmpty(ref.locator)) errors.push(`${label}: candidate locator must be recorded`);
      if (ref.locator_verification !== 'pending-human-review') {
        errors.push(`${label}: locator_verification must remain pending-human-review during discovery`);
      }
    }
  }

  const leads = Array.isArray(manifest.excluded_or_discovery_leads) ? manifest.excluded_or_discovery_leads : [];
  for (const lead of leads) {
    const label = lead.candidate_id || '<excluded entry missing id>';
    if (!nonEmpty(lead.status)) errors.push(`${label}: excluded/lead status must be recorded`);
    if (!nonEmpty(lead.reason)) errors.push(`${label}: excluded/lead reason must be recorded`);
    if (!nonEmpty(lead.canonical_url)) errors.push(`${label}: excluded/lead canonical_url must be recorded`);
  }

  return { errors, summary, manifest };
}
function formatSummary(summary) {
  return [
    `claims_in_slice: ${summary.claims_in_slice}`,
    `candidate_sources_discovered: ${summary.candidate_sources_discovered}`,
    `mapped_count: ${summary.mapped_count}`,
    `citation_validated_count: ${summary.citation_validated_count}`,
    `technical_reviewed_count: ${summary.technical_reviewed_count}`,
    `instructional_reviewed_count: ${summary.instructional_reviewed_count}`,
    `approved_count: ${summary.approved_count}`,
    `assessment_eligible_count: ${summary.assessment_eligible_count}`
  ].join('\n');
}

function run() {
  const { errors, summary } = validateManifest();
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL: ${error}`);
    return 1;
  }
  console.log(formatSummary(summary));
  console.log('PASS: charging-system candidate-source manifest validates as discovery-only and fail-closed.');
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  validateManifest,
  formatSummary,
  MANIFEST_PATH,
  INTAKE_PATH,
  POLICY_PATH,
  ZERO_SUMMARY_KEYS
};

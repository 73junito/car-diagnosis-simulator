#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'data', 'evidence', 'review-queues', 'aut250-human-review-package-20260927.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const roles = ['rights', 'technical', 'instructional', 'safety'];

function roleComplete(role) {
  const review = pkg.reviewer_requirements?.[role];
  if (!review) return false;
  const checklistComplete = Object.values(review.checklist || {}).every(Boolean);
  const identityComplete = Boolean(
    review.reviewer_name &&
    review.reviewer_id &&
    review.qualification_reference &&
    review.reviewed_at
  );
  const decisionComplete = ['pass', 'pass-with-limitations'].includes(review.decision);
  return checklistComplete && identityComplete && decisionComplete;
}

const completedRoles = roles.filter(roleComplete);
const citationDecisionConfirmed =
  pkg.citation_evidence_decision?.approved_representation === 'metadata-only-citation-proof' &&
  pkg.citation_evidence_decision?.status === 'confirmed';

const result = {
  package_id: pkg.package_id,
  completed_roles: completedRoles,
  required_roles: roles,
  human_reviews_complete: completedRoles.length === roles.length,
  citation_evidence_decision_confirmed: citationDecisionConfirmed,
  release_gate_ready_for_deterministic_validation:
    completedRoles.length === roles.length && citationDecisionConfirmed,
  question_approval_effect: 'none',
  assessment_eligibility_effect: 'none'
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(result.release_gate_ready_for_deterministic_validation ? 0 : 2);

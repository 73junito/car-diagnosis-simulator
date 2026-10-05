'use strict';

const foundation = require('../../../data/architecture/agent-orchestration-foundation.json');
const WorkflowStateMachine = require('../governance/workflow-state-machine');

const REQUIRED_CHECKLIST = [
  'license_ok',
  'url_canonical',
  'answer_verified',
  'quote_in_source',
  'source_checksum',
  'explanation_verified',
  'citation_matches_excerpt',
];

function requireTruthy(value, message) {
  if (!value) throw new Error(message);
}

function buildApprovedProvenanceBackfill({
  runId,
  question,
  provenance,
  citationValidation,
  citations,
  sourceEvidence,
  importedAt = new Date().toISOString(),
  stateMachine = new WorkflowStateMachine(foundation),
} = {}) {
  requireTruthy(runId, 'Backfill requires runId');
  requireTruthy(question?.question_id, 'Backfill requires an existing question');
  requireTruthy(provenance?.id && provenance.question_id === question.question_id, 'Question provenance mismatch');
  requireTruthy(provenance.status === 'approved', 'Question provenance is not approved');
  requireTruthy(provenance.technical_reviewer_id && provenance.technical_reviewed_at, 'Technical review evidence is incomplete');
  requireTruthy(provenance.instructional_reviewer_id && provenance.instructional_reviewed_at, 'Instructional review evidence is incomplete');
  requireTruthy(provenance.approved_by && provenance.approved_at, 'Final human approval evidence is incomplete');

  for (const key of REQUIRED_CHECKLIST) {
    requireTruthy(provenance.validation_checklist?.[key] === true, `Validation checklist failed: ${key}`);
  }

  requireTruthy(citationValidation?.result === 'valid', 'Citation validation result is not valid');
  requireTruthy(citationValidation.source_hashes_verified === true, 'Citation source hashes are not verified');
  requireTruthy(citationValidation.excerpts_verified === true, 'Citation excerpts are not verified');
  requireTruthy(citationValidation.urls_verified === true, 'Citation URLs are not verified');
  requireTruthy(citationValidation.validated_at, 'Citation validation timestamp is missing');

  requireTruthy(Array.isArray(citations) && citations.length > 0, 'Question citations are missing');
  const roles = new Set(citations.map((item) => item.role));
  requireTruthy(roles.has('supports-answer'), 'Question is missing supports-answer citation');
  requireTruthy(roles.has('supports-explanation'), 'Question is missing supports-explanation citation');

  requireTruthy(Array.isArray(sourceEvidence) && sourceEvidence.length > 0, 'Source evidence is missing');
  for (const evidence of sourceEvidence) {
    requireTruthy(evidence.chunk_status === 'approved' && evidence.chunk_approved === true, 'Source chunk is not approved');
    requireTruthy(evidence.source_status === 'approved', 'Approved source is not active');
    requireTruthy(evidence.license_reviewed_at, 'Source license review timestamp is missing');
    requireTruthy(evidence.license?.rights_status === 'human_reviewed_approved', 'Source rights were not human approved');
    requireTruthy(evidence.license?.reuse_permission_verified === true, 'Source reuse permission is not verified');
  }

  const evidenceRefs = {
    questionId: question.question_id,
    provenanceId: provenance.id,
    citationValidationId: citationValidation.id || null,
    citationValidationMethod: citationValidation.validation_method || null,
    sourceIds: [...new Set(citations.map((item) => item.source_id))],
    chunkIds: [...new Set(citations.map((item) => item.chunk_id))],
    historicalImport: true,
    notAgentExecution: true,
    importedAt,
  };

  const states = [
    { actor: 'question-agent', state: 'drafted', evidenceAt: question.created_at || null },
    { actor: 'evidence-agent', from: 'drafted', state: 'evidence_mapped', evidenceAt: provenance.technical_reviewed_at },
    { actor: 'rights-agent', from: 'evidence_mapped', state: 'rights_reviewed', evidenceAt: sourceEvidence[0].license_reviewed_at },
    { actor: 'technical-review-agent', from: 'rights_reviewed', state: 'technically_reviewed', evidenceAt: provenance.technical_reviewed_at },
    { actor: 'evidence-agent', from: 'technically_reviewed', state: 'citation_validated', evidenceAt: citationValidation.validated_at },
    { actor: 'instructional-review-agent', from: 'citation_validated', state: 'instructionally_reviewed', evidenceAt: provenance.instructional_reviewed_at },
    { actor: 'human', from: 'instructionally_reviewed', state: 'final_content_approved', evidenceAt: provenance.approved_at },
  ];

  for (const step of states.slice(1)) {
    const decision = stateMachine.canTransition({
      from: step.from,
      to: step.state,
      actor: step.actor,
      explicitHumanApproval: step.actor === 'human',
    });
    requireTruthy(decision.allowed, `Backfill transition denied: ${step.from} -> ${step.state}`);
  }

  return states.map((step, index) => ({
    runId,
    actor: step.actor,
    action: 'provenance-state-backfilled',
    state: step.state,
    metadata: {
      ...evidenceRefs,
      sequence: index + 1,
      sourceStateEvidenceAt: step.evidenceAt,
      from: step.from || null,
      to: step.state,
      reviewerIdentity: step.actor === 'human' ? provenance.approved_by : null,
      approvalEvidence: step.actor === 'human' ? `question_provenance:${provenance.id}` : null,
    },
  }));
}

module.exports = {
  buildApprovedProvenanceBackfill,
  REQUIRED_CHECKLIST,
};

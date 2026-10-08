'use strict';

const fs = require('fs');
const path = require('path');
const { collectUnresolvedGovernanceDecisions } = require('../src/ai/runtime/native-final-content-approval');

const CONTRACT_PATH = path.join(
  __dirname,
  '..',
  'data',
  'architecture',
  'agent-orchestration-native-final-content-approval.json'
);

const decision = (process.env.FINAL_APPROVAL_DECISION || '').toLowerCase();
const reviewerId = process.env.FINAL_APPROVAL_REVIEWER_ID || '';
const reviewedAt = process.env.FINAL_APPROVAL_REVIEWED_AT || '';
const checklistCompleted = process.env.FINAL_APPROVAL_CHECKLIST_COMPLETED === 'true';
const approvalEvidence = process.env.FINAL_APPROVAL_EVIDENCE || '';
const submittedBy = process.env.GITHUB_ACTOR || process.env.FINAL_APPROVAL_SUBMITTED_BY || '';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function failClosed(result) {
  console.log(JSON.stringify(result));
  process.exit(1);
}

(async () => {
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  requireCondition(contract.phase === '10H', 'Phase 10H contract is required.');
  requireCondition(
    contract.status === 'draft-non-dispatchable',
    'Phase 10H contract must remain draft-non-dispatchable.'
  );

  // Fail closed on unresolved governance decisions before any input or production access.
  const unresolved = collectUnresolvedGovernanceDecisions(contract);
  if (unresolved.length > 0) {
    failClosed({
      failClosed: true,
      phase: '10H',
      reason: 'unresolved-governance-decisions',
      unresolved,
      productionWritePerformed: false
    });
  }

  requireCondition(['approve', 'reject'].includes(decision), 'Final approval decision must be approve or reject.');
  requireCondition(/^[0-9a-f-]{36}$/i.test(reviewerId), 'A valid final approver UUID is required.');
  requireCondition(!Number.isNaN(Date.parse(reviewedAt)), 'A valid final approval timestamp is required.');
  requireCondition(checklistCompleted, 'The human final approval checklist must be completed.');
  requireCondition(approvalEvidence.trim().length > 0, 'Final approval evidence is required.');
  requireCondition(submittedBy.trim().length > 0, 'Submission actor is required.');

  // Phase 10H is non-production by contract: even with resolved governance the write path stays closed.
  failClosed({
    failClosed: true,
    phase: '10H',
    reason: 'phase-10h-non-production-write-path-disabled',
    productionWritePerformed: false
  });
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
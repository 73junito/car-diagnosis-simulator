'use strict';

const fs = require('fs');
const path = require('path');

const contractPath = path.join(
  __dirname,
  '..',
  'data',
  'architecture',
  'agent-orchestration-native-publication.json'
);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

const UNRESOLVED = 'UNRESOLVED_GOVERNANCE_DECISION';

describe('Phase 10I native publication governance scaffold', () => {
  test('is non-dispatchable and preserves explicit human publication authority', () => {
    expect(contract.phase).toBe('10I');
    expect(contract.status).toBe('draft-non-dispatchable');
    expect(contract.state_transition).toEqual({
      from: 'final_content_approved',
      to: UNRESOLVED,
      actor: 'human',
      requires_explicit_human_approval: true,
    });
    expect(contract.unresolved_governance_decisions).toEqual([
      'PUBLICATION_APPROVER_REQUIRED_ROLE',
      'PUBLICATION_APPROVER_REQUIRED_SCOPE',
      'independencePolicy.independentFromFinalContentApprover',
      'checklistVersion',
      'checklistCriteria',
      'publicationTarget',
    ]);
  });

  test('binds the exact successful Phase 10H control point', () => {
    expect(contract.control_commit).toBe('ee754cae6fa945bdf2a8b387da17968e59bc33eb');
    expect(contract.referenced_10H_evidence).toMatchObject({
      governed_run_id: 'native-draft:37418457881:charging-system',
      github_actions_run_id: 37724308574,
      workflow_run_conclusion: 'success',
      state: 'final_content_approved',
      checkpoint_version: 7,
      status: 'final-content-approved',
      question_id: 'charging-system-ai-draft-e9ac4b22b122',
      provenance_id: 'c3b07430-db49-4216-9878-c3efb4ab0a54',
      payload_sha256: '1b833a88a6fc8a0a79feaaa3f8848ac4b8cb3573f158effa0a6593bebf7cf10e',
      final_approval_evidence_hash: 'be5e7646827acfc26fc1f7d9d673f832622dab5b0838d0eadc8862db644f95fc',
      final_approver_id: '3739032e-01bc-48ca-b211-1ecdef38dbeb',
      human_final_decision: 'approve',
      human_final_decision_captured: true,
      agent_synthesized_decision: false,
      human_approval: true,
    });
  });

  test('grants zero production writes while governance is unresolved', () => {
    expect(contract.current_storage_boundary).toEqual({
      public_scenario_questions_write: false,
      assessment_eligibility_write: false,
      question_provenance_write: false,
      orchestration_ledger_write: false,
      citation_validation_write: false,
    });
  });

  test('separates publication from assessment eligibility and all scored or release authority', () => {
    expect(contract.planned_effect_if_later_explicitly_approved).toEqual({
      public_scenario_question_rows_for_exact_question: 1,
      assessment_eligibility_rows_for_exact_question: 0,
      assessment_eligible: false,
      scored_delivery_authority: false,
      delivery_authority: false,
      grading_authority: false,
      institutional_assessment_eligible: false,
      high_stakes_eligible: false,
      certification_eligible: false,
      production_assessment_api_eligible: false,
      assessment_release: false,
      broad_production_release: false,
    });
    expect(contract.next_governance_boundary).toEqual({
      after_publication: 'separate assessment-eligibility decision',
      automatic_advance: false,
    });
  });

  test('contains no resolved publication role, scope, checklist, target, or independence decision', () => {
    expect(contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_ROLE).toBe(UNRESOLVED);
    expect(contract.governance_constants.PUBLICATION_APPROVER_REQUIRED_SCOPE).toBe(UNRESOLVED);
    expect(contract.governance_constants.independencePolicy.independentFromFinalContentApprover).toBeNull();
    expect(contract.governance_constants.checklistVersion).toBe(UNRESOLVED);
    expect(contract.governance_constants.checklistCriteria).toEqual([UNRESOLVED]);
    expect(contract.governance_constants.publicationTarget).toBe(UNRESOLVED);
  });

  test('adds no dispatch workflow or production publication script', () => {
    expect(
      fs.existsSync(path.join(__dirname, '..', '.github', 'workflows', 'publish-native-question.yml'))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(__dirname, '..', 'scripts', 'publish-native-question.js'))
    ).toBe(false);
  });
});

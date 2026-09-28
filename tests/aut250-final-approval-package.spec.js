const fs = require('fs');
const path = require('path');

describe('AUT-250 final approval package', () => {
  const approval = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'evidence', 'approval-records',
      'aut250-training-batch-001-final-approval-20260927.json'),
    'utf8'
  ));

  test('records explicit final user approval for training use only', () => {
    expect(approval.requested_final_decision.scope).toBe('training-bank-final-approval-only');
    expect(approval.requested_final_decision.decision).toBe('approved');
    expect(approval.requested_final_decision.approver_name).toBe('Rafael Rodriguez');
    expect(approval.requested_final_decision.approver_id).toBe('rafael-rodriguez');
    expect(approval.requested_final_decision.approved_at).toBe('2026-09-27');
    expect(approval.requested_final_decision.user_confirmation)
      .toBe('I approve the AUT-250 training-bank final approval as written.');
    expect(approval.release_state.training_bank_final_approval)
      .toBe('approved-for-training-use');
  });

  test('binds final approval to completed prerequisite gates', () => {
    expect(approval.prerequisite_state.candidate_supported_questions).toBe(20);
    expect(approval.prerequisite_state.human_reviews_complete).toBe(true);
    expect(approval.prerequisite_state.required_human_roles)
      .toEqual(['rights', 'technical', 'instructional', 'safety']);
    expect(approval.prerequisite_state.citation_representation)
      .toBe('metadata-only-citation-proof');
    expect(approval.prerequisite_state.deterministic_metadata_validation).toBe('valid');
    expect(approval.prerequisite_state.deterministic_questions_valid).toBe(20);
    expect(approval.prerequisite_state.deterministic_questions_invalid).toBe(0);
  });

  test('final approval remains training-only and cannot imply high-stakes release', () => {
    const effect = approval.approval_effect_if_confirmed;
    expect(effect.question_status).toBe('approved-for-training-use');
    expect(effect.training_delivery_allowed).toBe(true);
    expect(effect.scored).toBe(false);
    expect(effect.high_stakes_eligible).toBe(false);
    expect(effect.institutional_assessment_eligible).toBe(false);
    expect(effect.production_assessment_api_eligible).toBe(false);
    expect(effect.legacy_citation_validation_effect).toBe('none');
    expect(effect.source_rights_clearance_effect).toBe('none');

    expect(approval.release_state.production_release).toBe(false);
    expect(approval.release_state.high_stakes_release).toBe(false);
    expect(approval.release_state.assessment_release).toBe(false);
  });
});

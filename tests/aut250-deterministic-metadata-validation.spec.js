const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

describe('AUT-250 deterministic metadata citation validation', () => {
  const artifactRel = 'data/evidence/validation-results/aut250-training-batch-001-metadata-validation-20260927.json';
  const artifact = JSON.parse(read(artifactRel));

  test('records a valid 20-question deterministic metadata validation', () => {
    expect(artifact.validator_version).toBe('aut250-metadata-citation-validator-1.0');
    expect(artifact.validation_method).toBe('deterministic-metadata-only-citation-proof');
    expect(artifact.approved_representation).toBe('metadata-only-citation-proof');
    expect(artifact.result).toBe('valid');
    expect(artifact.summary.questions_valid).toBe(20);
    expect(artifact.summary.questions_invalid).toBe(0);
    expect(artifact.summary.candidate_sources).toBe(16);
    expect(artifact.summary.metadata_linkage_verified).toBe(true);
    expect(artifact.summary.deterministic_validation_complete).toBe(true);
    expect(artifact.question_results).toHaveLength(20);
    expect(artifact.question_results.every((item) => item.result === 'valid')).toBe(true);
  });

  test('binds the validation result to exact governing input hashes', () => {
    for (const [rel, expectedHash] of Object.entries(artifact.input_integrity)) {
      expect(sha256(read(rel))).toBe(expectedHash);
    }
  });

  test('requires all four human roles in the validated evidence state', () => {
    expect(artifact.human_review_complete).toBe(true);
    expect(artifact.human_review_roles_complete)
      .toEqual(['rights', 'technical', 'instructional', 'safety']);
  });

  test('records post-validation gate status with final approval still blocked', () => {
    const status = JSON.parse(read(
      'data/evidence/validation-results/aut250-training-batch-001-gate-status-20260927.json'
    ));
    expect(status.deterministic_metadata_validation.status).toBe('complete');
    expect(status.deterministic_metadata_validation.result).toBe('valid');
    expect(status.deterministic_metadata_validation.questions_valid).toBe(20);
    expect(status.human_reviews.status).toBe('complete');
    expect(status.citation_representation.representation).toBe('metadata-only-citation-proof');
    expect(status.remaining_gate.status).toBe('blocked-pending-separate-final-approval');
    expect(status.remaining_gate.final_approval_recorded).toBe(false);
    expect(status.effects.question_approval).toBe('none');
    expect(status.effects.assessment_eligibility).toBe(false);
    expect(status.effects.production_release).toBe(false);
    expect(status.effects.high_stakes_use).toBe(false);
    expect(status.effects.legacy_citation_validations_written).toBe(false);
  });

  test('does not overclaim excerpt, rights, approval, assessment, or release effects', () => {
    expect(artifact.claims.metadata_identity_and_linkage_verified).toBe(true);
    expect(artifact.claims.source_excerpt_verified).toBe(false);
    expect(artifact.claims.source_text_hash_verified).toBe(false);
    expect(artifact.claims.rights_clearance_claimed).toBe(false);
    expect(artifact.claims.production_legacy_citation_validation_written).toBe(false);
    expect(artifact.claims.question_approval_effect).toBe('none');
    expect(artifact.claims.assessment_eligibility_effect).toBe('none');
    expect(artifact.claims.release_effect).toBe('none');
  });
});

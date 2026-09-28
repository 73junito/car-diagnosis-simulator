const fs = require('fs');
const path = require('path');

describe('AUT-250 human review gate package', () => {
  const pkg = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'evidence', 'review-queues', 'aut250-human-review-package-20260927.json'),
    'utf8'
  ));

  test('starts fail-closed with no reviewer identity or approvals', () => {
    expect(pkg.approval_effect).toBe('none');
    expect(pkg.current_state.questions_candidate_supported).toBe(20);
    expect(pkg.current_state.questions_approved).toBe(0);
    expect(pkg.current_state.questions_citation_validated).toBe(0);
    expect(pkg.current_state.assessment_eligible).toBe(false);
    expect(pkg.current_state.release_eligible).toBe(false);
  });

  test('requires four named human review roles', () => {
    const roles = ['rights', 'technical', 'instructional', 'safety'];
    expect(Object.keys(pkg.reviewer_requirements).sort()).toEqual(roles.sort());

    for (const role of roles) {
      const review = pkg.reviewer_requirements[role];
      expect(review.required).toBe(true);
      expect(review.reviewer_name).toBeNull();
      expect(review.reviewer_id).toBeNull();
      expect(review.qualification_reference).toBeNull();
      expect(review.reviewed_at).toBeNull();
      expect(review.decision).toBe('pending');
      expect(Object.values(review.checklist).every((value) => value === false)).toBe(true);
    }
  });

  test('keeps citation evidence options explicit without selecting one', () => {
    expect(pkg.citation_evidence_decision.status).toBe('pending-human-rights-and-governance-decision');
    expect(pkg.citation_evidence_decision.approved_representation).toBeNull();
    expect(pkg.citation_evidence_decision.options_under_review).toHaveLength(2);
    expect(pkg.citation_evidence_decision.options_under_review.map((item) => item.option_id))
      .toEqual(['approved-excerpt-chunks', 'metadata-only-citation-proof']);
  });

  test('selects metadata-only citation proof as a pending project preference', () => {
    expect(pkg.citation_evidence_decision.project_preference.option_id).toBe('metadata-only-citation-proof');
    expect(pkg.citation_evidence_decision.project_preference.status).toBe('selected-pending-human-confirmation');
    expect(pkg.citation_evidence_decision.project_preference.approval_effect).toBe('none');
    expect(pkg.citation_evidence_decision.metadata_preflight.script)
      .toBe('scripts/validate-aut250-metadata-citations.js');
    expect(pkg.citation_evidence_decision.metadata_preflight.writes_production_validation_records).toBe(false);
    expect(pkg.citation_evidence_decision.metadata_preflight.explicitly_does_not_validate)
      .toEqual(expect.arrayContaining([
        'source excerpt text',
        'source text hashes',
        'copyright or license clearance',
        'question approval',
        'assessment eligibility'
      ]));
  });

  test('prohibits validator shortcuts and auto approval', () => {
    expect(pkg.citation_evidence_decision.prohibited_shortcuts.join(' ')).toMatch(/Do not weaken citation-validator-1\.0/i);
    expect(pkg.citation_evidence_decision.prohibited_shortcuts.join(' ')).toMatch(/Do not create fake or synthetic source chunks/i);
    expect(pkg.release_gate.status).toBe('blocked');
    expect(pkg.release_gate.auto_approval_allowed).toBe(false);
    expect(pkg.release_gate.required_conditions).toEqual(expect.arrayContaining([
      'rights review completed',
      'technical review completed',
      'instructional review completed',
      'safety review completed',
      'deterministic citation validation completed under the approved representation',
      'separate final approval action recorded'
    ]));
  });
});

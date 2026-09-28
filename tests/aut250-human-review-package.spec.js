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

  test('requires four human review roles and records all four completed gates', () => {
    const roles = ['rights', 'technical', 'instructional', 'safety'];
    expect(Object.keys(pkg.reviewer_requirements).sort()).toEqual(roles.sort());

    const rights = pkg.reviewer_requirements.rights;
    expect(rights.required).toBe(true);
    expect(rights.reviewer_name).toBe('Rafael Rodriguez');
    expect(rights.reviewer_id).toBe('rafael-rodriguez');
    expect(rights.qualification_reference).toMatch(/project owner/i);
    expect(rights.reviewed_at).toBe('2026-09-27');
    expect(rights.decision).toBe('pass-with-limitations');
    expect(Object.values(rights.checklist).every(Boolean)).toBe(true);

    const technical = pkg.reviewer_requirements.technical;
    expect(technical.required).toBe(true);
    expect(technical.reviewer_name).toBe('Rafael Rodriguez');
    expect(technical.reviewer_id).toBe('rafael-rodriguez');
    expect(technical.qualification_reference).toMatch(/automotive instructor/i);
    expect(technical.reviewed_at).toBe('2026-09-27');
    expect(technical.decision).toBe('pass-with-limitations');
    expect(Object.values(technical.checklist).every(Boolean)).toBe(true);
    expect(technical.limitations).toEqual(expect.arrayContaining([
      expect.stringMatching(/conceptual training questions/i),
      expect.stringMatching(/Vehicle-specific voltages/i),
      expect.stringMatching(/single observation cannot by itself establish component failure/i),
      expect.stringMatching(/AutoLearnPro project-authored diagnostic framework/i),
      expect.stringMatching(/does not approve citations/i)
    ]));

    const instructional = pkg.reviewer_requirements.instructional;
    expect(instructional.required).toBe(true);
    expect(instructional.reviewer_name).toBe('Rafael Rodriguez');
    expect(instructional.reviewer_id).toBe('rafael-rodriguez');
    expect(instructional.qualification_reference).toMatch(/post-secondary automotive instructor/i);
    expect(instructional.reviewed_at).toBe('2026-09-27');
    expect(instructional.decision).toBe('pass-with-limitations');
    expect(Object.values(instructional.checklist).every(Boolean)).toBe(true);
    expect(instructional.limitations).toEqual(expect.arrayContaining([
      expect.stringMatching(/formative training questions/i),
      expect.stringMatching(/reasoning, uncertainty, evidence correlation/i),
      expect.stringMatching(/Distractors must not normalize unsafe service shortcuts/i),
      expect.stringMatching(/analytics must not substitute for technical or safety review/i),
      expect.stringMatching(/does not approve rights, citations, safety/i)
    ]));

    const safety = pkg.reviewer_requirements.safety;
    expect(safety.required).toBe(true);
    expect(safety.reviewer_name).toBe('Rafael Rodriguez');
    expect(safety.reviewer_id).toBe('rafael-rodriguez');
    expect(safety.qualification_reference).toMatch(/shop safety/i);
    expect(safety.reviewed_at).toBe('2026-09-27');
    expect(safety.decision).toBe('pass-with-limitations');
    expect(Object.values(safety.checklist).every(Boolean)).toBe(true);
    expect(safety.limitations).toEqual(expect.arrayContaining([
      expect.stringMatching(/conceptual and training-focused/i),
      expect.stringMatching(/High-voltage isolation/i),
      expect.stringMatching(/bypassing interlocks/i),
      expect.stringMatching(/must not authorize component removal/i),
      expect.stringMatching(/does not by itself approve citation validation/i)
    ]));
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

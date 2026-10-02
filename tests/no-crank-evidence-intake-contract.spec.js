const fs = require('fs');
const path = require('path');

describe('no-crank evidence intake contract', () => {
  const root = path.resolve(__dirname, '..');
  const intake = JSON.parse(fs.readFileSync(
    path.join(root, 'data', 'evidence', 'review-queues', 'no-crank-source-intake-20261002.json'),
    'utf8'
  ));

  test('covers all 20 no-crank questions without changing approval state', () => {
    expect(intake.scenario_id).toBe('no-crank');
    expect(intake.question_mappings).toHaveLength(20);
    expect(new Set(intake.question_mappings.map((row) => row.question_id)).size).toBe(20);
    expect(intake.governance.assessment_eligibility_changed).toBe(false);
    expect(intake.summary.approved_questions_created).toBe(0);
    expect(intake.summary.approved_sources_created).toBe(0);
    expect(intake.summary.approved_chunks_created).toBe(0);
    expect(intake.summary.database_writes).toBe(0);
  });

  test('keeps every candidate source fail-closed', () => {
    expect(intake.source_candidates.length).toBeGreaterThan(0);
    for (const source of intake.source_candidates) {
      expect(source.evidence_decision).toBe('candidate-only');
      expect(source.may_generate_questions).toBe(false);
      expect(source.store_verbatim_excerpt).toBe(false);
      expect(source.approval_effect).toBe('none');
    }
  });

  test('does not disguise source gaps as evidence coverage', () => {
    const sourceGapRows = intake.question_mappings.filter((row) =>
      String(row.mapping_status).startsWith('source-gap')
    );
    const mappedRows = intake.question_mappings.filter((row) =>
      Array.isArray(row.candidate_sources) && row.candidate_sources.length > 0
    );

    expect(sourceGapRows).toHaveLength(intake.summary.source_gap_count);
    expect(mappedRows).toHaveLength(intake.summary.mapped_to_at_least_one_candidate_source);

    for (const row of sourceGapRows) {
      expect(row.candidate_sources).toHaveLength(0);
    }
  });

  test('preserves external-reference-only rights boundaries', () => {
    const externalOnly = intake.source_candidates.filter((source) =>
      String(source.rights_decision).includes('external-reference-only')
    );
    expect(externalOnly.length).toBeGreaterThan(0);

    for (const source of externalOnly) {
      expect(source.permitted_project_use).toMatch(/metadata|bibliographic/i);
      expect(source.may_generate_questions).toBe(false);
    }
  });
});

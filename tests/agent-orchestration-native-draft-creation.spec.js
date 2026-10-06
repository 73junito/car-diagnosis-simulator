'use strict';

const fs = require('fs');
const path = require('path');
const {
  validateNativeDraftArtifact,
  buildScenarioQuestionRow,
  buildDraftProvenanceRow,
  assertExactExistingQuestion,
  assertDraftProvenance,
} = require('../src/ai/runtime/native-question-draft');

const root = path.resolve(__dirname, '..');

function fixture() {
  return {
    generator: { scenario_id: 'charging-system' },
    governance: {
      auto_approval: false,
      evidence_only: true,
      rights_verified_sources_only: true,
      requires_human_technical_review: true,
      requires_human_instructional_review: true,
    },
    evidence: [{ source_id: 'source-1', chunk_id: 'chunk-1' }],
    questions: [{
      scenario_slug: 'charging-system',
      question_id: 'charging-system-ai-draft-abc123',
      difficulty: 'intermediate',
      question: 'Which statement is directly supported by the supplied evidence?',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      correct_answer: 'A',
      explanation: 'The supplied evidence directly supports option A.',
      citations: [
        { source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-answer' },
        { source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-explanation' },
      ],
      status: 'draft',
      human_technical_review_completed: false,
      human_instructional_review_completed: false,
      approved: false,
    }],
  };
}

describe('Phase 10B native governed draft creation', () => {
  test('accepts one evidence-bound draft and builds draft-only database rows', () => {
    const question = validateNativeDraftArtifact(fixture(), { scenarioId: 'charging-system' });

    expect(buildScenarioQuestionRow(question)).toEqual({
      scenario_id: 'charging-system',
      question_id: 'charging-system-ai-draft-abc123',
      question_text: 'Which statement is directly supported by the supplied evidence?',
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      correct_answer: 'A',
      explanation: 'The supplied evidence directly supports option A.',
      difficulty: 'intermediate',
    });

    expect(buildDraftProvenanceRow(question.question_id)).toMatchObject({
      question_id: question.question_id,
      provenance_version: 1,
      status: 'draft',
      validation_checklist: {
        sources_linked: false,
        citations_validated: false,
        technical_review_complete: false,
        instructional_review_complete: false,
      },
    });
  });

  test('fails closed if generated artifact claims approval or completed review', () => {
    const approved = fixture();
    approved.questions[0].approved = true;
    expect(() => validateNativeDraftArtifact(approved, { scenarioId: 'charging-system' }))
      .toThrow(/already approved/);

    const technical = fixture();
    technical.questions[0].human_technical_review_completed = true;
    expect(() => validateNativeDraftArtifact(technical, { scenarioId: 'charging-system' }))
      .toThrow(/technical review/);

    const instructional = fixture();
    instructional.questions[0].human_instructional_review_completed = true;
    expect(() => validateNativeDraftArtifact(instructional, { scenarioId: 'charging-system' }))
      .toThrow(/instructional review/);
  });

  test('fails closed unless exactly one question is generated', () => {
    const none = fixture();
    none.questions = [];
    expect(() => validateNativeDraftArtifact(none, { scenarioId: 'charging-system' }))
      .toThrow(/exactly one/);

    const multiple = fixture();
    multiple.questions.push({ ...multiple.questions[0], question_id: 'charging-system-ai-draft-def456' });
    expect(() => validateNativeDraftArtifact(multiple, { scenarioId: 'charging-system' }))
      .toThrow(/exactly one/);
  });

  test('fails closed when a citation is outside the artifact evidence set', () => {
    const doc = fixture();
    doc.questions[0].citations[0].chunk_id = 'unapproved-chunk';
    expect(() => validateNativeDraftArtifact(doc, { scenarioId: 'charging-system' }))
      .toThrow(/outside the artifact evidence set/);
  });

  test('idempotent existing-question verification requires exact content identity', () => {
    const question = validateNativeDraftArtifact(fixture(), { scenarioId: 'charging-system' });
    const expected = buildScenarioQuestionRow(question);

    expect(() => assertExactExistingQuestion({ ...expected }, expected)).not.toThrow();
    expect(() => assertExactExistingQuestion({ ...expected, correct_answer: 'B' }, expected))
      .toThrow(/correct_answer/);
  });

  test('existing provenance must still be an unreviewed draft', () => {
    const draft = {
      question_id: 'charging-system-ai-draft-abc123',
      status: 'draft',
      technical_reviewer_id: null,
      technical_reviewed_at: null,
      instructional_reviewer_id: null,
      instructional_reviewed_at: null,
      approved_by: null,
      approved_at: null,
    };

    expect(() => assertDraftProvenance(draft, draft.question_id)).not.toThrow();
    expect(() => assertDraftProvenance({ ...draft, status: 'approved' }, draft.question_id))
      .toThrow(/not draft/);
    expect(() => assertDraftProvenance({ ...draft, approved_by: 'reviewer' }, draft.question_id))
      .toThrow(/review or approval/);
  });

  test('workflow keeps Ollama and production credentials isolated and does not persist citations', () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github', 'workflows', 'create-native-governed-question-draft.yml'),
      'utf8'
    );
    const ingest = fs.readFileSync(
      path.join(root, 'scripts', 'ingest-native-question-draft.js'),
      'utf8'
    );

    expect(workflow).toContain('environment: ollama');
    expect(workflow).toContain('TORQUEMIND_ORCHESTRATION_PERSISTENCE: disabled');
    expect(workflow).toContain('OLLAMA_API_KEY: ${{ secrets.API_GITHUB }}');
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}');

    const generateSection = workflow.split('  ingest:')[0];
    const ingestSection = workflow.split('  ingest:')[1];
    expect(generateSection).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(ingestSection).not.toContain('OLLAMA_API_KEY');

    expect(ingest).toContain(".from('scenario_questions')");
    expect(ingest).toContain(".from('question_provenance')");
    expect(ingest).toContain(".from('question_citations')");
    expect(ingest).not.toMatch(/\.from\('question_citations'\)[\s\S]{0,160}\.insert\(/);
    expect(ingest).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,160}\.insert\(/);
  });
});

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  validateNativeDraftArtifact,
  buildPrivateDraftRow,
  buildDraftProvenanceRow,
  assertExactExistingPrivateDraft,
  assertDraftProvenance,
} = require('../src/ai/runtime/native-question-draft');

const root = path.resolve(__dirname, '..');

function fixture() {
  return {
    generator: {
      scenario_id: 'charging-system',
      provider: 'ollama-cloud',
      model: 'gpt-oss:20b',
      agent_version: 'automotive-question-agent-v2',
    },
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
  test('accepts one evidence-bound draft and builds an exact private-store record', () => {
    const document = fixture();
    const question = validateNativeDraftArtifact(document, { scenarioId: 'charging-system' });
    const payloadText = JSON.stringify(document, null, 2) + '\n';

    const row = buildPrivateDraftRow(document, question, {
      governedRunId: 'native-draft:123:charging-system',
      workflowRunId: 123,
      workflowRunAttempt: 1,
      sourceCommit: 'a'.repeat(40),
      payloadText,
    });

    expect(row).toMatchObject({
      governed_run_id: 'native-draft:123:charging-system',
      question_id: 'charging-system-ai-draft-abc123',
      scenario_id: 'charging-system',
      workflow_run_id: 123,
      workflow_run_attempt: 1,
      source_commit: 'a'.repeat(40),
      status: 'drafted-unreviewed',
      payload_text: payloadText,
    });
    expect(row.payload_sha256).toBe(
      crypto.createHash('sha256').update(payloadText).digest('hex')
    );
  });

  test('draft provenance keeps every downstream governance gate false', () => {
    const provenance = buildDraftProvenanceRow('charging-system-ai-draft-abc123', {
      privateDraftId: '11111111-1111-1111-1111-111111111111',
      payloadSha256: 'b'.repeat(64),
      agentVersion: 'automotive-question-agent-v2',
    });

    expect(provenance).toMatchObject({
      question_id: 'charging-system-ai-draft-abc123',
      provenance_version: 1,
      status: 'draft',
      validation_checklist: {
        sources_linked: false,
        citations_validated: false,
        technical_review_complete: false,
        instructional_review_complete: false,
      },
    });
    expect(provenance.notes).toContain('private_draft_id=11111111-1111-1111-1111-111111111111');
    expect(provenance.notes).toContain('payload_sha256=' + 'b'.repeat(64));
  });

  test('fails closed if generated artifact claims approval, review, or unsupported evidence', () => {
    const approved = fixture();
    approved.questions[0].approved = true;
    expect(() => validateNativeDraftArtifact(approved, { scenarioId: 'charging-system' }))
      .toThrow(/already approved/);

    const technical = fixture();
    technical.questions[0].human_technical_review_completed = true;
    expect(() => validateNativeDraftArtifact(technical, { scenarioId: 'charging-system' }))
      .toThrow(/technical review/);

    const unsupported = fixture();
    unsupported.questions[0].citations[0].chunk_id = 'outside-bundle';
    expect(() => validateNativeDraftArtifact(unsupported, { scenarioId: 'charging-system' }))
      .toThrow(/outside the artifact evidence set/);
  });

  test('requires exactly one generated question', () => {
    const none = fixture();
    none.questions = [];
    expect(() => validateNativeDraftArtifact(none, { scenarioId: 'charging-system' }))
      .toThrow(/exactly one/);

    const multiple = fixture();
    multiple.questions.push({ ...multiple.questions[0], question_id: 'charging-system-ai-draft-def456' });
    expect(() => validateNativeDraftArtifact(multiple, { scenarioId: 'charging-system' }))
      .toThrow(/exactly one/);
  });

  test('idempotency rejects payload drift but tolerates workflow-attempt metadata changes', () => {
    const document = fixture();
    const question = validateNativeDraftArtifact(document, { scenarioId: 'charging-system' });
    const base = buildPrivateDraftRow(document, question, {
      governedRunId: 'native-draft:123:charging-system',
      workflowRunId: 123,
      workflowRunAttempt: 1,
      sourceCommit: 'a'.repeat(40),
      payloadText: JSON.stringify(document),
    });

    expect(() => assertExactExistingPrivateDraft(
      { ...base, workflow_run_attempt: 2 },
      base
    )).not.toThrow();

    expect(() => assertExactExistingPrivateDraft(
      { ...base, payload_sha256: 'c'.repeat(64) },
      base
    )).toThrow(/payload_sha256/);
  });

  test('existing provenance must remain bound to the same untouched private draft', () => {
    const draft = {
      question_id: 'charging-system-ai-draft-abc123',
      status: 'draft',
      technical_reviewer_id: null,
      technical_reviewed_at: null,
      instructional_reviewer_id: null,
      instructional_reviewed_at: null,
      approved_by: null,
      approved_at: null,
      notes: 'private_draft_id=private-1 payload_sha256=' + 'd'.repeat(64),
    };

    expect(() => assertDraftProvenance(draft, draft.question_id, {
      privateDraftId: 'private-1',
      payloadSha256: 'd'.repeat(64),
    })).not.toThrow();

    expect(() => assertDraftProvenance({ ...draft, status: 'approved' }, draft.question_id))
      .toThrow(/not draft/);

    expect(() => assertDraftProvenance(draft, draft.question_id, {
      privateDraftId: 'private-2',
      payloadSha256: 'd'.repeat(64),
    })).toThrow(/expected private draft/);
  });

  test('private store migration is service-role-only with RLS and no policies', () => {
    const migration = fs.readFileSync(
      path.join(root, 'supabase', 'migrations', '20261006033456_add_native_governed_question_drafts.sql'),
      'utf8'
    ).toLowerCase();

    expect(migration).toContain('alter table public.native_governed_question_drafts enable row level security');
    expect(migration).toContain('revoke all on table public.native_governed_question_drafts');
    expect(migration).toContain('from public, anon, authenticated, service_role');
    expect(migration).toContain('grant select, insert on table public.native_governed_question_drafts');
    expect(migration).toContain('to service_role');
    expect(migration).not.toContain('create policy');
    expect(migration).toContain("check (status = 'drafted-unreviewed')");
    expect(migration).toContain('payload_text text not null');
  });

  test('workflow isolates credentials, uses stable run identity, and never promotes to public questions', () => {
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
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY:');
    expect(workflow).toContain('GOVERNED_RUN_ID: native-draft:');
    expect(workflow).not.toContain('github.run_attempt');
    expect(workflow).toContain('--target=1');

    const generateSection = workflow.split('  ingest:')[0];
    const ingestSection = workflow.split('  ingest:')[1];
    expect(generateSection).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(ingestSection).not.toContain('OLLAMA_API_KEY');

    expect(ingest).toContain(".from('native_governed_question_drafts')");
    expect(ingest).toContain(".from('question_provenance')");
    expect(ingest).toContain(".from('scenario_questions')");
    expect(ingest).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,250}\.insert\(/);
    expect(ingest).not.toMatch(/\.from\('question_citations'\)[\s\S]{0,250}\.insert\(/);
    expect(ingest).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,250}\.insert\(/);
  });
});

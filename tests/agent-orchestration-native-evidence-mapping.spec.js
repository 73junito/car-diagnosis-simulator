'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  citationIdentity,
  parsePrivateDraftPayload,
  buildCitationRows,
  assertSameCitationSet,
  assertMappingInvariants,
} = require('../src/ai/runtime/native-evidence-mapping');
const { validateNativeDraftArtifact } = require('../src/ai/runtime/native-question-draft');

const root = path.resolve(__dirname, '..');
const PROVENANCE_ID = '22222222-2222-2222-2222-222222222222';

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

function governedSource(overrides = {}) {
  return {
    id: 'source-1',
    status: 'approved',
    license: { spdx: 'CC-BY-4.0' },
    license_reviewed_at: '2026-10-01T00:00:00Z',
    license_reviewed_by: '11111111-1111-1111-1111-111111111111',
    ...overrides,
  };
}

function governedChunk(overrides = {}) {
  return {
    chunk_id: 'chunk-1',
    source_id: 'source-1',
    status: 'approved',
    approved: true,
    locator: 'Page 3',
    text_excerpt: 'The alternator supplies electric energy to the vehicle.',
    ...overrides,
  };
}

function governedRightsScope(overrides = {}) {
  return {
    source_id: 'source-1',
    citation_link_allowed: true,
    direct_excerpt_allowed: true,
    database_storage_allowed: true,
    effective_at: '2026-10-01',
    expires_at: null,
    license_evidence_reference: 'https://example.test/license',
    reviewed_by: '33333333-3333-3333-3333-333333333333',
    reviewed_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function mappingInput(overrides = {}) {
  return {
    question: validatedQuestion(),
    provenanceId: PROVENANCE_ID,
    sources: [governedSource()],
    chunks: [governedChunk()],
    rightsScopes: [governedRightsScope()],
    currentDate: '2026-10-06',
    ...overrides,
  };
}

function validatedQuestion() {
  return validateNativeDraftArtifact(fixture(), { scenarioId: 'charging-system' });
}

describe('Phase 10C native evidence mapping', () => {
  test('builds exact citation rows bound to the draft provenance', () => {
    const rows = buildCitationRows(mappingInput());

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.role)).toEqual(['supports-answer', 'supports-explanation']);
    for (const row of rows) {
      expect(row.question_provenance_id).toBe(PROVENANCE_ID);
      expect(row.source_id).toBe('source-1');
      expect(row.chunk_id).toBe('chunk-1');
      expect(row.quote).toBe('The alternator supplies electric energy to the vehicle.');
      expect(row.locator).toBe('Page 3');
    }
  });

  test('rejects chunk identity drift across sources', () => {
    expect(() => buildCitationRows(mappingInput({
      chunks: [governedChunk({ source_id: 'source-2' })],
    }))).toThrow(/does not belong to the cited source/);

    expect(() => buildCitationRows(mappingInput({
      chunks: [],
    }))).toThrow(/not a governed record/);
  });

  test('rejects sources and chunks without governed rights evidence', () => {
    const base = mappingInput();

    expect(() => buildCitationRows({
      ...base,
      sources: [governedSource({ status: 'validated' })],
    })).toThrow(/not an approved governed record/);

    expect(() => buildCitationRows({
      ...base,
      sources: [governedSource({ license_reviewed_at: null })],
    })).toThrow(/no complete license review evidence/);

    expect(() => buildCitationRows({
      ...base,
      sources: [governedSource({ license_reviewed_by: null })],
    })).toThrow(/no complete license review evidence/);

    expect(() => buildCitationRows({
      ...base,
      sources: [governedSource({ license: {} })],
    })).toThrow(/no recorded license/);

    expect(() => buildCitationRows({
      ...base,
      chunks: [governedChunk({ approved: false })],
    })).toThrow(/not an approved governed record/);
  });

  test('fails closed when use-specific rights do not permit persisted excerpt citations', () => {
    const base = mappingInput();

    expect(() => buildCitationRows({
      ...base,
      rightsScopes: [],
    })).toThrow(/no approved rights scope/);

    for (const field of ['citation_link_allowed', 'direct_excerpt_allowed', 'database_storage_allowed']) {
      expect(() => buildCitationRows({
        ...base,
        rightsScopes: [governedRightsScope({ [field]: false })],
      })).toThrow(/rights do not permit citation excerpt storage/);
    }

    expect(() => buildCitationRows({
      ...base,
      rightsScopes: [governedRightsScope({ reviewed_by: null })],
    })).toThrow(/no complete human review evidence/);

    expect(() => buildCitationRows({
      ...base,
      rightsScopes: [governedRightsScope({ license_evidence_reference: '' })],
    })).toThrow(/no complete human review evidence/);

    expect(() => buildCitationRows({
      ...base,
      rightsScopes: [governedRightsScope({ effective_at: '2026-10-07' })],
    })).toThrow(/not yet effective/);

    expect(() => buildCitationRows({
      ...base,
      rightsScopes: [governedRightsScope({ expires_at: '2026-10-05' })],
    })).toThrow(/has expired/);
  });

  test('private payload integrity fails closed on sha drift', () => {
    const payloadText = JSON.stringify(fixture(), null, 2) + '\n';
    const sha256 = crypto.createHash('sha256').update(payloadText).digest('hex');

    const document = parsePrivateDraftPayload(payloadText, sha256);
    expect(document.questions).toHaveLength(1);

    expect(() => parsePrivateDraftPayload(payloadText, 'f'.repeat(64)))
      .toThrow(/sha256 drift/);
    const badJsonSha = crypto.createHash('sha256').update('{not-json').digest('hex');
    expect(() => parsePrivateDraftPayload('{not-json', badJsonSha))
      .toThrow(/not valid JSON/);
    expect(() => parsePrivateDraftPayload('', sha256))
      .toThrow(/payload text is missing/);
  });

  test('idempotent rerun requires the exact persisted citation set', () => {
    const expected = buildCitationRows(mappingInput())
      .map((row, index) => ({ id: `row-${index}`, ...row }));

    expect(() => assertSameCitationSet(expected, expected)).not.toThrow();

    expect(() => assertSameCitationSet(expected.slice(1), expected))
      .toThrow(/count does not match/);
    expect(() => assertSameCitationSet(
      expected.map((row, index) => (index === 0 ? { ...row, role: 'supports-question' } : row)),
      expected
    )).toThrow(/missing/);

    for (const [field, value] of [
      ['question_provenance_id', '44444444-4444-4444-4444-444444444444'],
      ['locator', 'Page 99'],
      ['quote', 'Drifted excerpt'],
    ]) {
      expect(() => assertSameCitationSet(
        expected.map((row, index) => (index === 0 ? { ...row, [field]: value } : row)),
        expected
      )).toThrow(new RegExp(`drift detected.*${field}`));
    }

    expect(citationIdentity(expected[0])).toBe('source-1::chunk-1::supports-answer');
  });

  test('mapping invariants keep the question private and unreviewed', () => {
    const provenance = {
      question_id: 'charging-system-ai-draft-abc123',
      status: 'draft',
      technical_reviewer_id: null,
      technical_reviewed_at: null,
      instructional_reviewer_id: null,
      instructional_reviewed_at: null,
      approved_by: null,
      approved_at: null,
    };

    expect(() => assertMappingInvariants({ scenarioQuestionCount: 0, provenance }))
      .not.toThrow();
    expect(() => assertMappingInvariants({ scenarioQuestionCount: 1, provenance }))
      .toThrow(/public scenario_questions/);
    expect(() => assertMappingInvariants({
      scenarioQuestionCount: 0,
      provenance: { ...provenance, status: 'source-linked' },
    })).toThrow(/must remain draft/);
    expect(() => assertMappingInvariants({
      scenarioQuestionCount: 0,
      provenance: { ...provenance, technical_reviewed_at: '2026-10-01T00:00:00Z' },
    })).toThrow(/human review evidence/);
    expect(() => assertMappingInvariants({
      scenarioQuestionCount: 0,
      provenance: { ...provenance, approved_at: '2026-10-01T00:00:00Z' },
    })).toThrow(/approval evidence/);
  });

  test('runtime records the governed drafted to evidence_mapped transition', () => {
    const runtime = fs.readFileSync(
      path.join(root, 'src', 'ai', 'runtime', 'persistent-governance-runtime.js'),
      'utf8'
    );
    const coordinator = fs.readFileSync(
      path.join(root, 'src', 'ai', 'governance', 'production-run-coordinator.js'),
      'utf8'
    );

    expect(runtime).toContain('async recordEvidenceMapping(');
    expect(runtime).toContain("action: 'evidence-mapping-recorded'");
    expect(runtime).toContain("state: 'evidence_mapped'");
    expect(runtime).toContain("actor = 'evidence-agent'");
    expect(runtime).toContain("latest.action !== 'draft-initialized' || latest.state !== 'drafted'");
    expect(runtime).toContain("from: 'drafted'");
    expect(runtime).toContain("to: 'evidence_mapped'");
    expect(runtime).toContain('humanApproval: false');
    expect(runtime).not.toMatch(/recordEvidenceMapping[\s\S]{0,1600}explicitHumanApproval: true/);
    expect(coordinator).toContain("'evidence-mapping-recorded': 'evidence-mapped'");
  });

  test('foundation authorizes only evidence-agent for drafted to evidence_mapped', () => {
    const foundation = JSON.parse(fs.readFileSync(
      path.join(root, 'data', 'architecture', 'agent-orchestration-foundation.json'),
      'utf8'
    ));

    const transition = foundation.transitions.find(
      (entry) => entry.from === 'drafted' && entry.to === 'evidence_mapped'
    );
    expect(transition).toBeDefined();
    expect(transition.actors).toEqual(['evidence-agent']);

    const evidenceAgent = foundation.agents.find((agent) => agent.id === 'evidence-agent');
    expect(evidenceAgent).toBeDefined();
    expect(evidenceAgent.may_prepare).toBe(true);
    expect(evidenceAgent.may_human_approve).toBe(false);
    expect(evidenceAgent.may_release).toBe(false);
    expect(foundation.states).toContain('evidence_mapped');
  });

  test('script persists citations without promoting or approving anything', () => {
    const script = fs.readFileSync(
      path.join(root, 'scripts', 'map-native-question-evidence.js'),
      'utf8'
    );

    expect(script).toContain(".from('native_governed_question_drafts')");
    expect(script).toContain('parsePrivateDraftPayload');
    expect(script).toContain("assertDraftProvenance");
    expect(script).toContain(".from('question_citations')");
    expect(script).toContain(".from('approved_sources')");
    expect(script).toContain(".from('approved_source_rights_scopes')");
    expect(script).toContain(".from('source_chunks')");
    expect(script).toContain('recordEvidenceMapping');
    expect(script).toContain('assertMappingInvariants');
    expect(script).toContain(".from('scenario_questions')");
    expect(script).toContain(".from('assessment_question_eligibility')");
    expect(script).toContain('citationsPersisted');
    expect(script).toContain('publicScenarioQuestionRows: scenarioQuestionCount');
    expect(script).toContain('scoredDeliveryAuthority: false');
    expect(script.indexOf('publicQuestionsBefore')).toBeGreaterThan(-1);
    expect(script.indexOf('.insert(expectedRows)')).toBeGreaterThan(script.indexOf('publicQuestionsBefore'));
    expect(script).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,250}\.insert\(/);
    expect(script).not.toMatch(/\.from\('question_provenance'\)[\s\S]{0,400}\.update\(/);
    expect(script).not.toMatch(/\.from\('citation_validations'\)[\s\S]{0,250}\.insert\(/);
    expect(script).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,250}\.insert\(/);
    expect(script).not.toContain('--artifact');
    expect(script).toContain("entry.action !== 'draft-initialized' && entry.action !== 'evidence-mapping-recorded'");
    expect(script).not.toMatch(/\.from\('question_provenance'\)[\s\S]{0,250}\.insert\(/);
  });

  test('workflow maps evidence only in the production environment', () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github', 'workflows', 'map-native-question-evidence.yml'),
      'utf8'
    );

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production');
    expect(workflow).toContain('TORQUEMIND_ORCHESTRATION_PERSISTENCE: supabase');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}');
    expect(workflow).toContain('governed_run_id');
    expect(workflow).toContain('group: native-evidence-mapping-${{ inputs.governed_run_id }}');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('map-native-question-evidence.js');
    expect(workflow).toContain('timeout-minutes: 5');
    expect(workflow).not.toContain('environment: ollama');
    expect(workflow).not.toContain('OLLAMA_API_KEY');
    expect(workflow.match(/runs-on:/g)).toHaveLength(1);
  });

  test('design record locks the narrow transition scope', () => {
    const record = JSON.parse(fs.readFileSync(
      path.join(root, 'data', 'architecture', 'agent-orchestration-native-evidence-mapping.json'),
      'utf8'
    ));

    expect(record.phase).toBe('phase-10c-native-evidence-mapping');
    expect(record.status).toBe('prepared-not-deployed');
    expect(record.governed_transition).toEqual({
      from: 'drafted',
      to: 'evidence_mapped',
      actor: 'evidence-agent',
      ledger_action: 'evidence-mapping-recorded',
    });
    expect(record.storage_boundary.public_scenario_questions_write).toBe(false);
    expect(record.storage_boundary.citation_validations_persisted).toBe(false);
    expect(record.authority_invariants).toEqual(expect.arrayContaining([
      expect.stringContaining('No public scenario question is created.'),
      expect.stringContaining('No assessment eligibility'),
      expect.stringContaining('review fields remain empty'),
      expect.stringContaining('approval fields remain empty'),
      expect.stringContaining('Promotion into scenario_questions is a later'),
    ]));
  });
});

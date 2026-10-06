'use strict';

const fs = require('fs');
const path = require('path');
const {
  stableRightsEvidenceHash,
  buildRightsReviewEvidence,
  assertRightsReviewInvariants,
} = require('../src/ai/runtime/native-rights-review');

const root = path.resolve(__dirname, '..');

function source(overrides = {}) {
  return {
    id: 'source-1',
    status: 'approved',
    license: {
      rights_status: 'human_reviewed_approved',
      reuse_permission_verified: true,
      classification: 'CC_BY',
    },
    license_reviewed_by: '11111111-1111-1111-1111-111111111111',
    license_reviewed_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function scope(overrides = {}) {
  return {
    source_id: 'source-1',
    citation_link_allowed: true,
    direct_excerpt_allowed: true,
    database_storage_allowed: true,
    effective_at: '2026-10-01',
    expires_at: null,
    license_evidence_reference: 'https://creativecommons.org/licenses/by/4.0/',
    reviewed_by: '11111111-1111-1111-1111-111111111111',
    reviewed_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const citations = [
  { source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-answer' },
  { source_id: 'source-1', chunk_id: 'chunk-1', role: 'supports-explanation' },
];

describe('Phase 10D native rights review', () => {
  test('builds deterministic evidence from existing human rights reviews', () => {
    const result = buildRightsReviewEvidence({
      citations,
      sources: [source()],
      rightsScopes: [scope()],
      currentDate: '2026-10-06',
    });

    expect(result.evidence).toEqual([expect.objectContaining({
      sourceId: 'source-1',
      reviewerIdentity: '11111111-1111-1111-1111-111111111111',
      rightsStatus: 'human_reviewed_approved',
      reusePermissionVerified: true,
      citationLinkAllowed: true,
      directExcerptAllowed: true,
      databaseStorageAllowed: true,
    })]);
    expect(result.evidenceHash).toBe(stableRightsEvidenceHash(result.evidence));
    expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('fails closed without human-reviewed approved source rights', () => {
    expect(() => buildRightsReviewEvidence({
      citations,
      sources: [source({ license: { rights_status: 'pending', reuse_permission_verified: true } })],
      rightsScopes: [scope()],
      currentDate: '2026-10-06',
    })).toThrow(/not human-reviewed approved/);

    expect(() => buildRightsReviewEvidence({
      citations,
      sources: [source({ license: { rights_status: 'human_reviewed_approved', reuse_permission_verified: false } })],
      rightsScopes: [scope()],
      currentDate: '2026-10-06',
    })).toThrow(/reuse permission is not verified/);
  });

  test('fails closed on rights reviewer or timestamp conflict', () => {
    expect(() => buildRightsReviewEvidence({
      citations,
      sources: [source()],
      rightsScopes: [scope({ reviewed_by: '22222222-2222-2222-2222-222222222222' })],
      currentDate: '2026-10-06',
    })).toThrow(/reviewer identity conflicts/);

    expect(() => buildRightsReviewEvidence({
      citations,
      sources: [source()],
      rightsScopes: [scope({ reviewed_at: '2026-10-02T00:00:00Z' })],
      currentDate: '2026-10-06',
    })).toThrow(/timestamp conflicts/);
  });

  test('fails closed on missing, insufficient, future, or expired use-specific scope', () => {
    expect(() => buildRightsReviewEvidence({
      citations, sources: [source()], rightsScopes: [], currentDate: '2026-10-06',
    })).toThrow(/scope is missing/);

    expect(() => buildRightsReviewEvidence({
      citations, sources: [source()], rightsScopes: [scope({ direct_excerpt_allowed: false })], currentDate: '2026-10-06',
    })).toThrow(/does not permit/);

    expect(() => buildRightsReviewEvidence({
      citations, sources: [source()], rightsScopes: [scope({ effective_at: '2026-10-07' })], currentDate: '2026-10-06',
    })).toThrow(/not yet effective/);

    expect(() => buildRightsReviewEvidence({
      citations, sources: [source()], rightsScopes: [scope({ expires_at: '2026-10-05' })], currentDate: '2026-10-06',
    })).toThrow(/expired/);
  });

  test('post-conditions preserve private-unreviewed content authority', () => {
    const provenance = {
      status: 'draft',
      technical_reviewer_id: null,
      technical_reviewed_at: null,
      instructional_reviewer_id: null,
      instructional_reviewed_at: null,
      approved_by: null,
      approved_at: null,
    };

    expect(() => assertRightsReviewInvariants({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      citationValidationCount: 0,
      provenance,
    })).not.toThrow();

    expect(() => assertRightsReviewInvariants({
      scenarioQuestionCount: 1,
      assessmentEligibilityCount: 0,
      citationValidationCount: 0,
      provenance,
    })).toThrow(/public scenario_questions/);
    expect(() => assertRightsReviewInvariants({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      citationValidationCount: 1,
      provenance,
    })).toThrow(/citation validation/);
  });

  test('workflow and script create no new human or content authority', () => {
    const script = fs.readFileSync(path.join(root, 'scripts', 'review-native-question-rights.js'), 'utf8');
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'review-native-question-rights.yml'), 'utf8');
    const foundation = JSON.parse(fs.readFileSync(path.join(root, 'data', 'architecture', 'agent-orchestration-foundation.json'), 'utf8'));

    expect(script).toContain('recordRightsReview');
    expect(script).toContain(".from('approved_source_rights_scopes')");
    expect(script).toContain(".from('question_citations')");
    expect(script).not.toMatch(/\.from\('approved_source_rights_scopes'\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(script).not.toMatch(/\.from\('question_provenance'\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(script).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,300}\.insert\(/);
    expect(script).not.toMatch(/\.from\('citation_validations'\)[\s\S]{0,300}\.insert\(/);
    expect(script).toContain('newHumanDecision: false');
    expect(workflow).toContain('group: native-rights-review-${{ inputs.governed_run_id }}');
    expect(workflow).not.toContain('OLLAMA_API_KEY');

    const transition = foundation.transitions.find((item) =>
      item.from === 'evidence_mapped' && item.to === 'rights_reviewed'
    );
    expect(transition.actors).toEqual(['rights-agent']);
    const agent = foundation.agents.find((item) => item.id === 'rights-agent');
    expect(agent.may_prepare).toBe(true);
    expect(agent.may_human_approve).toBe(false);
    expect(agent.may_release).toBe(false);
  });
});

'use strict';

const fs = require('fs');
const path = require('path');
const {
  sha256,
  stableCitationSetHash,
  stableCitationValidationEvidenceHash,
  buildCitationValidationEvidence,
  assertCitationValidationContainment,
} = require('../src/ai/runtime/native-citation-validation');

const root = path.resolve(__dirname, '..');
const citation = {
  id: '11111111-1111-1111-1111-111111111111',
  source_id: 'source-1',
  chunk_id: 'chunk-1',
  locator: 'p. 1',
  quote: 'Battery voltage should be checked before further diagnosis.',
  role: 'supports-answer',
};
const source = {
  id: 'source-1',
  status: 'approved',
  storage_path: 'https://example.org/source.pdf',
  license: { rights_status: 'human_reviewed_approved', reuse_permission_verified: true },
  license_reviewed_by: '44444444-4444-4444-4444-444444444444',
  license_reviewed_at: '2026-10-01T00:00:00Z',
};
const chunk = {
  chunk_id: 'chunk-1',
  source_id: 'source-1',
  status: 'approved',
  approved: true,
  text_excerpt: citation.quote,
  text_hash: sha256(citation.quote),
};
const scope = {
  source_id: 'source-1',
  citation_link_allowed: true,
  direct_excerpt_allowed: true,
  database_storage_allowed: true,
  effective_at: '2026-10-01',
  expires_at: null,
  reviewed_by: source.license_reviewed_by,
  reviewed_at: source.license_reviewed_at,
};
const urlCheck = {
  sourceId: 'source-1',
  canonicalUrl: source.storage_path,
  httpStatus: 200,
  redirectCount: 0,
  valid: true,
};

describe('Phase 10F native citation validation', () => {
  test('binds the exact citation set and deterministic validation evidence', () => {
    const result = buildCitationValidationEvidence({
      provenanceId: '22222222-2222-2222-2222-222222222222',
      questionId: 'charging-system-native-01',
      payloadSha256: 'a'.repeat(64),
      citations: [citation],
      sources: [source],
      chunks: [chunk],
      rightsScopes: [scope],
      urlChecks: [urlCheck],
      currentDate: '2026-10-06',
      validatedAt: '2026-10-06T20:00:00.000Z',
    });

    expect(result.evidence).toMatchObject({
      citationCount: 1,
      citationSetHash: stableCitationSetHash([citation]),
      sourceHashesVerified: true,
      excerptsVerified: true,
      urlsVerified: true,
      result: 'valid',
      validatorVersion: 'native-citation-validator-1.0',
    });
    expect(result.evidenceHash).toBe(stableCitationValidationEvidenceHash(result.evidence));
  });

  test('fails closed on source/chunk, hash, excerpt, rights, or URL drift', () => {
    const base = {
      provenanceId: '22222222-2222-2222-2222-222222222222',
      questionId: 'charging-system-native-01',
      payloadSha256: 'a'.repeat(64),
      citations: [citation],
      sources: [source],
      chunks: [chunk],
      rightsScopes: [scope],
      urlChecks: [urlCheck],
      currentDate: '2026-10-06',
      validatedAt: '2026-10-06T20:00:00.000Z',
    };
    expect(() => buildCitationValidationEvidence({ ...base, chunks: [{ ...chunk, source_id: 'other' }] })).toThrow(/identity mismatch/);
    expect(() => buildCitationValidationEvidence({ ...base, chunks: [{ ...chunk, text_hash: 'b'.repeat(64) }] })).toThrow(/hash mismatch/);
    expect(() => buildCitationValidationEvidence({ ...base, citations: [{ ...citation, quote: 'changed' }] })).toThrow(/excerpt/);
    expect(() => buildCitationValidationEvidence({ ...base, rightsScopes: [{ ...scope, direct_excerpt_allowed: false }] })).toThrow(/rights scope/);
    expect(() => buildCitationValidationEvidence({ ...base, urlChecks: [{ ...urlCheck, httpStatus: 404, valid: false }] })).toThrow(/URL verification/);
  });

  test('containment preserves draft and all later authority boundaries', () => {
    const provenance = {
      status: 'draft',
      technical_reviewer_id: '33333333-3333-3333-3333-333333333333',
      technical_reviewed_at: '2026-10-06T19:20:00Z',
      instructional_reviewer_id: null,
      instructional_reviewed_at: null,
      approved_by: null,
      approved_at: null,
    };
    expect(() => assertCitationValidationContainment({
      scenarioQuestionCount: 0,
      assessmentEligibilityCount: 0,
      provenance,
    })).not.toThrow();
    expect(() => assertCitationValidationContainment({
      scenarioQuestionCount: 1,
      assessmentEligibilityCount: 0,
      provenance,
    })).toThrow(/public scenario_questions/);
  });

  test('workflow targets technically_reviewed only and exposes no approval or release authority', () => {
    const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'validate-native-question-citations.yml'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'scripts', 'validate-native-question-citations.js'), 'utf8');

    expect(workflow).toContain('group: native-citation-validation-${{ inputs.governed_run_id }}');
    expect(workflow).not.toContain('OLLAMA_API_KEY');
    expect(script).toContain("latest?.state === 'technically_reviewed'");
    expect(script).toContain(".from('citation_validations')");
    expect(script).toContain('recordCitationValidation');
    expect(script).not.toMatch(/\.from\('scenario_questions'\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(script).not.toMatch(/\.from\('assessment_question_eligibility'\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(script).not.toMatch(/\.from\('question_provenance'\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(script).not.toContain('recordHumanTransition(');
  });
});

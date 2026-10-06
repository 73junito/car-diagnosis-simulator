'use strict';

const crypto = require('crypto');

const SHA256 = /^[0-9a-f]{64}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim()).digest('hex');
}

function stableCitationValidationEvidenceHash(evidence) {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function stableCitationSetHash(citations) {
  const canonical = [...citations]
    .map((row) => ({
      id: row.id,
      source_id: row.source_id,
      chunk_id: row.chunk_id,
      role: row.role,
      quote: row.quote,
      locator: row.locator || null,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function buildCitationValidationEvidence({
  provenanceId,
  questionId,
  payloadSha256,
  citations,
  sources,
  chunks,
  rightsScopes,
  urlChecks,
  currentDate,
  validatedAt,
}) {
  requireCondition(typeof provenanceId === 'string' && provenanceId.length > 0, 'A provenanceId is required.');
  requireCondition(typeof questionId === 'string' && questionId.length > 0, 'A questionId is required.');
  requireCondition(SHA256.test(payloadSha256 || ''), 'A valid payload SHA-256 is required.');
  requireCondition(Array.isArray(citations) && citations.length > 0, 'Persisted citations are required.');
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(currentDate || ''), 'A valid currentDate is required.');
  requireCondition(typeof validatedAt === 'string' && !Number.isNaN(Date.parse(validatedAt)), 'A valid validatedAt is required.');

  const sourceById = new Map((sources || []).map((row) => [row.id, row]));
  const chunkById = new Map((chunks || []).map((row) => [row.chunk_id, row]));
  const scopeBySourceId = new Map((rightsScopes || []).map((row) => [row.source_id, row]));
  const urlBySourceId = new Map((urlChecks || []).map((row) => [row.sourceId, row]));
  const validationRows = [];

  for (const citation of [...citations].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const source = sourceById.get(citation.source_id);
    const chunk = chunkById.get(citation.chunk_id);
    const scope = scopeBySourceId.get(citation.source_id);
    const urlCheck = urlBySourceId.get(citation.source_id);

    requireCondition(source, 'Citation source is missing: ' + citation.source_id);
    requireCondition(source.status === 'approved', 'Citation source is not approved: ' + citation.source_id);
    requireCondition(
      source.license?.rights_status === 'human_reviewed_approved' &&
      source.license?.reuse_permission_verified === true,
      'Citation source rights are not human-reviewed approved: ' + citation.source_id
    );
    requireCondition(
      typeof source.license_reviewed_by === 'string' && source.license_reviewed_by.length > 0 &&
      typeof source.license_reviewed_at === 'string' && source.license_reviewed_at.length > 0,
      'Citation source license review evidence is incomplete: ' + citation.source_id
    );
    requireCondition(
      scope?.citation_link_allowed === true &&
      scope?.direct_excerpt_allowed === true &&
      scope?.database_storage_allowed === true,
      'Citation rights scope no longer permits mapped use: ' + citation.source_id
    );
    requireCondition(
      scope?.reviewed_by === source.license_reviewed_by &&
      scope?.reviewed_at === source.license_reviewed_at,
      'Citation rights review identity or timestamp no longer matches the approved source: ' + citation.source_id
    );
    requireCondition(
      !scope?.effective_at || scope.effective_at <= currentDate,
      'Citation rights scope is not yet effective: ' + citation.source_id
    );
    requireCondition(
      !scope?.expires_at || scope.expires_at >= currentDate,
      'Citation rights scope has expired: ' + citation.source_id
    );
    requireCondition(chunk, 'Citation chunk is missing: ' + citation.chunk_id);
    requireCondition(chunk.source_id === citation.source_id, 'Citation source/chunk identity mismatch: ' + citation.id);
    requireCondition(chunk.status === 'approved' && chunk.approved === true, 'Citation chunk is not approved: ' + citation.chunk_id);

    const recomputedHash = sha256(chunk.text_excerpt);
    requireCondition(SHA256.test(chunk.text_hash || ''), 'Citation chunk hash is malformed: ' + citation.chunk_id);
    requireCondition(recomputedHash === chunk.text_hash, 'Citation chunk hash mismatch: ' + citation.chunk_id);
    requireCondition(
      normalizeText(citation.quote) === normalizeText(chunk.text_excerpt),
      'Citation excerpt does not match governed chunk: ' + citation.id
    );
    requireCondition(
      urlCheck?.valid === true &&
      urlCheck?.canonicalUrl === source.storage_path &&
      Number.isInteger(urlCheck?.httpStatus) &&
      urlCheck.httpStatus >= 200 &&
      urlCheck.httpStatus < 300 &&
      urlCheck.redirectCount === 0,
      'Citation source URL verification failed: ' + citation.source_id
    );

    validationRows.push({
      citationId: citation.id,
      sourceId: citation.source_id,
      chunkId: citation.chunk_id,
      role: citation.role,
      chunkHash: chunk.text_hash,
      canonicalUrl: source.storage_path,
      httpStatus: urlCheck.httpStatus,
    });
  }

  const evidence = {
    provenanceId,
    questionId,
    payloadSha256,
    citationCount: citations.length,
    citationSetHash: stableCitationSetHash(citations),
    citations: validationRows,
    sourceHashesVerified: true,
    excerptsVerified: true,
    urlsVerified: true,
    result: 'valid',
    validatorVersion: 'native-citation-validator-1.0',
    validationMethod: 'deterministic-source-chunk-verification',
    validatedAt,
  };

  return { evidence, evidenceHash: stableCitationValidationEvidenceHash(evidence) };
}

function assertCitationValidationContainment({
  scenarioQuestionCount,
  assessmentEligibilityCount,
  provenance,
}) {
  requireCondition(scenarioQuestionCount === 0, 'Citation validation must not create public scenario_questions rows.');
  requireCondition(assessmentEligibilityCount === 0, 'Citation validation must not create assessment eligibility.');
  requireCondition(provenance?.status === 'draft', 'Provenance must remain draft during citation validation.');
  requireCondition(
    provenance.technical_reviewer_id && provenance.technical_reviewed_at,
    'Citation validation requires completed human technical review.'
  );
  requireCondition(
    !provenance.instructional_reviewer_id && !provenance.instructional_reviewed_at,
    'Citation validation must not synthesize instructional review.'
  );
  requireCondition(
    !provenance.approved_by && !provenance.approved_at,
    'Citation validation must not synthesize final content approval.'
  );
}

module.exports = {
  normalizeText,
  sha256,
  stableCitationSetHash,
  stableCitationValidationEvidenceHash,
  buildCitationValidationEvidence,
  assertCitationValidationContainment,
};

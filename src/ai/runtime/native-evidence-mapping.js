'use strict';

const crypto = require('crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA64 = /^[0-9a-f]{64}$/;
const ALLOWED_CITATION_ROLES = new Set([
  'supports-question',
  'supports-answer',
  'supports-explanation',
  'supports-next-step',
  'supports-ase-concept',
]);
const REQUIRED_CITATION_ROLES = ['supports-answer', 'supports-explanation'];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function citationIdentity(row) {
  return `${row?.source_id || ''}::${row?.chunk_id || ''}::${row?.role || ''}`;
}

function parsePrivateDraftPayload(payloadText, payloadSha256) {
  requireCondition(
    typeof payloadText === 'string' && payloadText.length > 0,
    'Private draft payload text is missing.'
  );
  requireCondition(SHA64.test(payloadSha256 || ''), 'Private draft payload sha256 is invalid.');

  const actualSha256 = crypto.createHash('sha256').update(payloadText).digest('hex');
  requireCondition(actualSha256 === payloadSha256, 'Private draft payload sha256 drift detected.');

  let document = null;
  try {
    document = JSON.parse(payloadText);
  } catch (error) {
    throw new Error('Private draft payload is not valid JSON.');
  }
  requireCondition(document && typeof document === 'object', 'Private draft payload is not an object.');
  return document;
}

// Builds the exact question_citations rows for one governed draft provenance.
// Every cited source/chunk pair must exist as an approved, rights-reviewed
// governed record, and the chunk must belong to the cited source (identity).
function buildCitationRows({ question, provenanceId, sources, chunks, rightsScopes, currentDate }) {
  requireCondition(UUID.test(provenanceId || ''), 'A valid provenanceId is required.');
  requireCondition(question && Array.isArray(question.citations), 'Draft question citations are missing.');
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(currentDate || ''), 'A valid currentDate is required.');


  const roles = new Set(question.citations.map((citation) => citation?.role));
  for (const role of REQUIRED_CITATION_ROLES) {
    requireCondition(roles.has(role), `Evidence mapping requires a ${role} citation.`);
  }

  const sourceById = new Map((sources || []).map((source) => [source.id, source]));
  const chunkById = new Map((chunks || []).map((chunk) => [chunk.chunk_id, chunk]));
  const rightsBySourceId = new Map((rightsScopes || []).map((scope) => [scope.source_id, scope]));
  const seen = new Set();
  const rows = [];

  for (const citation of question.citations) {
    requireCondition(
      ALLOWED_CITATION_ROLES.has(citation?.role),
      'Cited evidence role is not permitted by schema.'
    );
    requireCondition(
      typeof citation.source_id === 'string' && citation.source_id.length > 0 &&
        typeof citation.chunk_id === 'string' && citation.chunk_id.length > 0,
      'Cited evidence identity is incomplete.'
    );

    const source = sourceById.get(citation.source_id);
    requireCondition(source, `Cited source is not a governed record: ${citation.source_id}`);
    requireCondition(
      source.status === 'approved',
      `Cited source is not an approved governed record: ${citation.source_id}`
    );
    requireCondition(
      source.license && typeof source.license === 'object' && Object.keys(source.license).length > 0,
      `Cited source has no recorded license: ${citation.source_id}`
    );
    requireCondition(
      typeof source.license_reviewed_at === 'string' && source.license_reviewed_at.length > 0 &&
        typeof source.license_reviewed_by === 'string' && source.license_reviewed_by.length > 0,
      `Cited source has no complete license review evidence: ${citation.source_id}`
    );

    const rights = rightsBySourceId.get(citation.source_id);
    requireCondition(rights, `Cited source has no approved rights scope: ${citation.source_id}`);
    requireCondition(
      rights.citation_link_allowed === true &&
        rights.direct_excerpt_allowed === true &&
        rights.database_storage_allowed === true,
      `Cited source rights do not permit citation excerpt storage: ${citation.source_id}`
    );
    requireCondition(
      typeof rights.reviewed_by === 'string' && rights.reviewed_by.length > 0 &&
        typeof rights.reviewed_at === 'string' && rights.reviewed_at.length > 0 &&
        typeof rights.license_evidence_reference === 'string' &&
        rights.license_evidence_reference.trim().length > 0,
      `Cited source rights scope has no complete human review evidence: ${citation.source_id}`
    );
    requireCondition(
      !rights.effective_at || rights.effective_at <= currentDate,
      `Cited source rights scope is not yet effective: ${citation.source_id}`
    );
    requireCondition(
      !rights.expires_at || rights.expires_at >= currentDate,
      `Cited source rights scope has expired: ${citation.source_id}`
    );

    const chunk = chunkById.get(citation.chunk_id);
    requireCondition(chunk, `Cited chunk is not a governed record: ${citation.chunk_id}`);
    requireCondition(
      chunk.source_id === citation.source_id,
      `Cited chunk does not belong to the cited source: ${citation.chunk_id}`
    );
    requireCondition(
      chunk.status === 'approved' && chunk.approved === true,
      `Cited chunk is not an approved governed record: ${citation.chunk_id}`
    );

    const identity = citationIdentity(citation);
    requireCondition(!seen.has(identity), `Duplicate citation in draft evidence: ${identity}`);
    seen.add(identity);

    rows.push({
      question_provenance_id: provenanceId,
      source_id: citation.source_id,
      chunk_id: citation.chunk_id,
      locator:
        typeof citation.locator === 'string' && citation.locator.trim()
          ? citation.locator
          : (chunk.locator || null),
      quote: chunk.text_excerpt,
      role: citation.role,
    });
  }

  requireCondition(rows.length > 0, 'No citation rows were built for evidence mapping.');
  return rows;
}

// Idempotency guard: reruns must observe the exact citation set that was
// persisted for this provenance. Any drift fails closed.
function normalizeNullableText(value) {
  return typeof value === 'string' && value.length ? value : null;
}

function assertSameCitationSet(existing, expected) {
  const existingByIdentity = new Map(
    (existing || []).map((row) => [citationIdentity(row), row])
  );
  const expectedByIdentity = new Map(
    (expected || []).map((row) => [citationIdentity(row), row])
  );

  requireCondition(
    existingByIdentity.size === (existing || []).length,
    'Persisted citation mapping contains duplicate identities.'
  );
  requireCondition(
    expectedByIdentity.size === (expected || []).length,
    'Expected citation mapping contains duplicate identities.'
  );
  requireCondition(
    existingByIdentity.size === expectedByIdentity.size,
    'Persisted citation count does not match the draft evidence.'
  );

  for (const [identity, expectedRow] of expectedByIdentity) {
    const existingRow = existingByIdentity.get(identity);
    requireCondition(existingRow, `Persisted citation mapping is missing: ${identity}`);

    for (const field of ['question_provenance_id', 'source_id', 'chunk_id', 'role']) {
      requireCondition(
        existingRow[field] === expectedRow[field],
        `Persisted citation mapping drift detected for ${identity} at ${field}.`
      );
    }
    for (const field of ['locator', 'quote']) {
      requireCondition(
        normalizeNullableText(existingRow[field]) === normalizeNullableText(expectedRow[field]),
        `Persisted citation mapping drift detected for ${identity} at ${field}.`
      );
    }
  }
}

// Post-mapping invariants: the draft stays private and unreviewed.
function assertMappingInvariants({ scenarioQuestionCount, provenance }) {
  requireCondition(
    Number.isInteger(scenarioQuestionCount) && scenarioQuestionCount === 0,
    'Native evidence mapping must not create public scenario_questions rows.'
  );
  requireCondition(provenance && typeof provenance === 'object', 'Provenance record is required.');
  requireCondition(
    provenance.status === 'draft',
    'Provenance status must remain draft during evidence mapping.'
  );
  requireCondition(
    !provenance.technical_reviewer_id &&
      !provenance.technical_reviewed_at &&
      !provenance.instructional_reviewer_id &&
      !provenance.instructional_reviewed_at,
    'Provenance already contains human review evidence after evidence mapping.'
  );
  requireCondition(
    !provenance.approved_by && !provenance.approved_at,
    'Provenance already contains approval evidence after evidence mapping.'
  );
}

module.exports = {
  citationIdentity,
  parsePrivateDraftPayload,
  buildCitationRows,
  assertSameCitationSet,
  assertMappingInvariants,
};

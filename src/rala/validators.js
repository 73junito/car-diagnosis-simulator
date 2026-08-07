const { validateCitation, isGroundedResponseShape } = require('../tutor/groundedResponseSchema');

const APPROVED_SOURCE_STATUSES = new Set([
  'draft',
  'source-linked',
  'validated',
  'approved',
  'retired',
  'superseded'
]);

const CHUNK_STATUSES = new Set([
  'draft',
  'source-linked',
  'validated',
  'approved',
  'retired',
  'superseded'
]);

function ok() {
  return { ok: true, reason: null };
}

function fail(reason, details) {
  return { ok: false, reason, details: details || null };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteInteger(value) {
  return Number.isInteger(value) && Number.isFinite(value);
}

function validateApprovedSourceMetadata(source) {
  if (!isObject(source)) {
    return fail('INVALID_APPROVED_SOURCE_METADATA');
  }

  if (!isNonEmptyString(source.id)) return fail('MISSING_SOURCE_ID');
  if (!isNonEmptyString(source.title)) return fail('MISSING_SOURCE_TITLE');
  if (!isNonEmptyString(source.storage_path)) return fail('MISSING_SOURCE_STORAGE_PATH');
  if (!isNonEmptyString(source.checksum)) return fail('MISSING_SOURCE_CHECKSUM');
  if (!isNonEmptyString(source.checksum_algorithm)) return fail('MISSING_SOURCE_CHECKSUM_ALGORITHM');
  if (!isFiniteInteger(source.version) || source.version < 1) return fail('INVALID_SOURCE_VERSION');
  if (!isNonEmptyString(source.status) || !APPROVED_SOURCE_STATUSES.has(source.status)) {
    return fail('INVALID_SOURCE_STATUS');
  }

  return ok();
}

function validateChunkProvenance(chunk) {
  if (!isObject(chunk)) {
    return fail('INVALID_CHUNK_PROVENANCE');
  }

  if (!isNonEmptyString(chunk.chunk_id)) return fail('MISSING_CHUNK_ID');
  if (!isNonEmptyString(chunk.source_id)) return fail('MISSING_CHUNK_SOURCE_ID');
  if (!isFiniteInteger(chunk.source_version) || chunk.source_version < 1) return fail('INVALID_CHUNK_SOURCE_VERSION');
  if (!isNonEmptyString(chunk.text_excerpt)) return fail('MISSING_CHUNK_TEXT');
  if (!isFiniteInteger(chunk.token_count) || chunk.token_count < 0) return fail('INVALID_CHUNK_TOKEN_COUNT');
  if (!isNonEmptyString(chunk.text_hash)) return fail('MISSING_CHUNK_TEXT_HASH');
  if (!isNonEmptyString(chunk.status) || !CHUNK_STATUSES.has(chunk.status)) return fail('INVALID_CHUNK_STATUS');
  if (typeof chunk.approved !== 'boolean') return fail('INVALID_CHUNK_APPROVED_FLAG');

  const hasLocator = isNonEmptyString(chunk.locator);
  const hasSection = isNonEmptyString(chunk.section);
  const hasPage = Number.isInteger(chunk.page_start) || Number.isInteger(chunk.page_end);
  if (!hasLocator && !hasSection && !hasPage) {
    return fail('MISSING_CHUNK_PROVENANCE_ANCHOR');
  }

  return ok();
}

function validateRetrievedEvidenceRecord(record) {
  if (!isObject(record)) {
    return fail('INVALID_RETRIEVED_EVIDENCE_RECORD');
  }

  if (!isNonEmptyString(record.id)) return fail('MISSING_EMBEDDING_ID');
  if (!isNonEmptyString(record.chunkId)) return fail('MISSING_RETRIEVED_CHUNK_ID');
  if (!isNonEmptyString(record.sourceStatus) || record.sourceStatus !== 'approved') {
    return fail('UNAPPROVED_SOURCE_RETRIEVAL');
  }
  if (record.sourceRetired === true) return fail('RETIRED_SOURCE_RETRIEVAL');
  if (record.sourceSuperseded_by != null) return fail('SUPERSEDED_SOURCE_RETRIEVAL');
  if (!isNonEmptyString(record.chunkStatus) || record.chunkStatus !== 'approved') {
    return fail('UNAPPROVED_CHUNK_RETRIEVAL');
  }
  if (record.chunkDeleted === true) return fail('DELETED_CHUNK_RETRIEVAL');
  if (record.chunkSuperseded_by != null) return fail('SUPERSEDED_CHUNK_RETRIEVAL');

  return ok();
}

function validateRetrievalResult(result) {
  if (!isObject(result)) {
    return fail('INVALID_RETRIEVAL_RESULT');
  }

  if (result.status === 'insufficient') {
    if (result.answer !== undefined && result.answer !== null) return fail('INVALID_RETRIEVAL_RESULT');
    if (result.reason !== undefined && !isNonEmptyString(result.reason)) return fail('INVALID_RETRIEVAL_RESULT');
    if (result.evidence !== undefined && !Array.isArray(result.evidence)) return fail('INVALID_RETRIEVAL_RESULT');
    return ok();
  }

  if (result.status !== 'sufficient') {
    return fail('INVALID_RETRIEVAL_RESULT');
  }

  if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
    return fail('INVALID_RETRIEVAL_RESULT');
  }

  for (const evidence of result.evidence) {
    if (!isObject(evidence)) return fail('INVALID_RETRIEVAL_RESULT');
    if (!isNonEmptyString(evidence.citationLabel)) return fail('INVALID_RETRIEVAL_RESULT');
    if (!isNonEmptyString(evidence.chunkId)) return fail('INVALID_RETRIEVAL_RESULT');
    if (typeof evidence.score !== 'number' || !Number.isFinite(evidence.score)) return fail('INVALID_RETRIEVAL_RESULT');
  }

  return ok();
}

function validateCitationAgainstRetrievedEvidence(citation, retrievedEvidence) {
  const citationShape = validateCitation(citation);
  if (!citationShape) {
    return fail('INVALID_OR_INCOMPLETE_CITATIONS');
  }

  const evidence = Array.isArray(retrievedEvidence) ? retrievedEvidence : [];
  const match = evidence.find(item => {
    if (!item) return false;
    if (item.chunkId && citation.chunkId) {
      if (item.chunkId !== citation.chunkId) return false;
      if (item.sourceId && citation.sourceId) {
        return item.sourceId === citation.sourceId;
      }
      return true;
    }
    if (item.citationLabel && citation.label && item.citationLabel === citation.label) {
      return true;
    }
    return false;
  });
  if (!match) {
    return fail('CITATION_NOT_SUPPORTED_BY_RETRIEVED_CHUNKS');
  }

  return ok();
}

function validateCitationsAgainstRetrievedEvidence(citations, retrievedEvidence) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return fail('INVALID_OR_INCOMPLETE_CITATIONS');
  }

  for (const citation of citations) {
    const result = validateCitationAgainstRetrievedEvidence(citation, retrievedEvidence);
    if (!result.ok) return result;
  }

  return ok();
}

function validateGroundedResponseContract(payload) {
  if (!isGroundedResponseShape(payload)) {
    return fail('INVALID_GROUNDED_RESPONSE_SCHEMA');
  }

  return ok();
}

module.exports = {
  APPROVED_SOURCE_STATUSES,
  CHUNK_STATUSES,
  validateApprovedSourceMetadata,
  validateChunkProvenance,
  validateRetrievedEvidenceRecord,
  validateRetrievalResult,
  validateCitationAgainstRetrievedEvidence,
  validateCitationsAgainstRetrievedEvidence,
  validateGroundedResponseContract
};
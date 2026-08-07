const {
  validateApprovedSourceMetadata,
  validateChunkProvenance,
  validateRetrievedEvidenceRecord,
  validateRetrievalResult,
  validateCitationsAgainstRetrievedEvidence,
  validateGroundedResponseContract
} = require('../src/rala/validators');
const { isGroundedResponseShape } = require('../src/tutor/groundedResponseSchema');

describe('RALA contract validators', () => {
  const approvedSource = {
    id: 'fixture-approved-source',
    title: 'ASE A6 2024 (fixture)',
    publisher: 'ASE Foundation',
    storage_path: '/fixtures/ase-a6-2024.pdf',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    checksum_algorithm: 'sha256',
    version: 1,
    status: 'draft'
  };

  const approvedChunk = {
    chunk_id: 'fixture-approved-chunk',
    source_id: 'fixture-approved-source',
    source_version: 1,
    title: 'Starting System Diagnosis',
    section: 'Starter Circuit Testing',
    page_start: 118,
    page_end: 123,
    locator: 'A6 > Starting System > Starter Circuit Testing',
    text_excerpt: 'Fixture excerpt: check battery voltage at rest and under crank.',
    token_count: 50,
    text_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'draft',
    approved: true
  };

  const retrievedEvidence = [
    {
      citationLabel: 'C1',
      chunkId: 'fixture-approved-chunk',
      sourceId: 'fixture-approved-source',
      sourceVersion: 1,
      locator: 'A6 > Starting System > Starter Circuit Testing',
      text: 'Fixture excerpt: check battery voltage at rest and under crank.',
      score: 0.99,
      embeddingId: 'fixture-embedding-1'
    }
  ];

  test('approved source metadata fixture is valid', () => {
    expect(validateApprovedSourceMetadata(approvedSource)).toEqual({ ok: true, reason: null });
  });

  test('chunk provenance fixture is valid', () => {
    expect(validateChunkProvenance(approvedChunk)).toEqual({ ok: true, reason: null });
  });

  test('retrieved evidence record requires approved active source and chunk', () => {
    expect(validateRetrievedEvidenceRecord({
      id: 'embedding-1',
      chunkId: approvedChunk.chunk_id,
      sourceId: approvedSource.id,
      sourceStatus: 'approved',
      chunkStatus: 'approved'
    })).toEqual({ ok: true, reason: null });

    expect(validateRetrievedEvidenceRecord({
      id: 'embedding-2',
      chunkId: approvedChunk.chunk_id,
      sourceId: approvedSource.id,
      sourceStatus: 'draft',
      chunkStatus: 'approved'
    })).toEqual({ ok: false, reason: 'UNAPPROVED_SOURCE_RETRIEVAL', details: null });
  });

  test('retrieval result and citations are validated against retrieved chunks', () => {
    expect(validateRetrievalResult({ status: 'sufficient', evidence: retrievedEvidence })).toEqual({ ok: true, reason: null });

    expect(validateCitationsAgainstRetrievedEvidence([
      { label: 'C1', sourceId: 'fixture-approved-source', chunkId: 'fixture-approved-chunk', locator: 'A6 > Starting System > Starter Circuit Testing' }
    ], retrievedEvidence)).toEqual({ ok: true, reason: null });

    expect(validateCitationsAgainstRetrievedEvidence([
      { label: 'C1', sourceId: 'fixture-approved-source', chunkId: 'fixture-approved-chunk', locator: 'A6 > Starting System > Starter Circuit Testing' },
      { label: 'C2', sourceId: 'fixture-approved-source', chunkId: 'missing-chunk', locator: 'unknown' }
    ], retrievedEvidence)).toEqual({ ok: false, reason: 'CITATION_NOT_SUPPORTED_BY_RETRIEVED_CHUNKS', details: null });
  });

  test('grounded response contract reuses existing schema', () => {
    const payload = {
      status: 'grounded',
      answer: 'Inspect starter control circuit first. [C1]',
      citations: [
        { label: 'C1', sourceId: 'fixture-approved-source', chunkId: 'fixture-approved-chunk', locator: 'A6 > Starting System > Starter Circuit Testing' }
      ],
      reason: null
    };

    expect(validateGroundedResponseContract(payload)).toEqual({ ok: true, reason: null });
    expect(isGroundedResponseShape(payload)).toBe(true);
  });

  test('malformed fixture-like records are rejected', () => {
    expect(validateApprovedSourceMetadata({
      id: 'broken-source',
      title: 'Broken source',
      checksum: 'abc',
      checksum_algorithm: 'sha256',
      version: 1,
      status: 'draft'
    })).toEqual({ ok: false, reason: 'MISSING_SOURCE_STORAGE_PATH', details: null });

    expect(validateChunkProvenance({
      chunk_id: 'broken-chunk',
      source_id: 'fixture-approved-source',
      source_version: 1,
      text_excerpt: '',
      token_count: 10,
      text_hash: 'abc',
      status: 'draft',
      approved: true
    })).toEqual({ ok: false, reason: 'MISSING_CHUNK_TEXT', details: null });

    expect(validateRetrievalResult({ status: 'sufficient', evidence: [{ citationLabel: 'C1', sourceId: 's', chunkId: 'c' }] })).toEqual({ ok: false, reason: 'INVALID_RETRIEVAL_RESULT', details: null });
  });
});
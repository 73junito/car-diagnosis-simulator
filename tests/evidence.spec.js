const { assembleTutorEvidence, resolveCitation } = require('../src/evidence/assembler');
const MemoryMetadataStore = require('../src/embeddings/memoryStorageAdapter');

describe('citation resolver and evidence assembler', () => {
  let mstore;
  beforeEach(() => {
    mstore = new MemoryMetadataStore();
  });

  test('valid retrieval result assembles correctly', () => {
    const rec = { id: 'e1', chunkId: 'c1', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', locator: 'L1', title: 'T1', text: 'evidence text', sourceVersion: 1 };
    mstore.upsert(rec);
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'e1', chunkId: 'c1', sourceId: 's1', text: 'evidence text' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('ready');
    expect(out.citations.length).toBe(1);
    expect(out.citations[0].label).toBe('C1');
    expect(out.promptEvidence[0]).toContain('[C1]');
  });

  test('missing source ID rejected', () => {
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'x', chunkId: 'c1', text: 't' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });

  test('missing chunk ID rejected', () => {
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'x', sourceId: 's1', text: 't' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });

  test('missing locator rejected', () => {
    const rec = { id: 'e2', chunkId: 'c2', sourceId: 's2', sourceStatus: 'approved', chunkStatus: 'approved', text: 't' };
    mstore.upsert(rec);
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'e2', chunkId: 'c2', sourceId: 's2', text: 't' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });

  test('missing evidence text rejected', () => {
    const rec = { id: 'e3', chunkId: 'c3', sourceId: 's3', sourceStatus: 'approved', chunkStatus: 'approved', locator: 'L3', text: '' };
    mstore.upsert(rec);
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'e3', chunkId: 'c3', sourceId: 's3', text: '' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });

  test('duplicate citations collapsed and labels deterministic', () => {
    const rec1 = { id: 'ed1', chunkId: 'dup', sourceId: 's', sourceStatus: 'approved', chunkStatus: 'approved', locator: 'L', text: 't' };
    mstore.upsert(rec1);
    const retrieval = { status: 'sufficient', evidence: [
      { embeddingId: 'ed1', chunkId: 'dup', sourceId: 's', text: 't' },
      { embeddingId: 'ed1', chunkId: 'dup', sourceId: 's', text: 't' }
    ] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('ready');
    expect(out.citations.length).toBe(1);
    expect(out.citations[0].label).toBe('C1');
  });

  test('superseded evidence rejected', () => {
    const recOld = { id: 'os', chunkId: 'c', sourceId: 's', sourceStatus: 'approved', chunkStatus: 'approved', locator: 'L', text: 't', superseded_by: 'os2' };
    mstore.upsert(recOld);
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'os', chunkId: 'c', sourceId: 's', text: 't' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });

  test('unresolved source metadata rejected', () => {
    const retrieval = { status: 'sufficient', evidence: [{ embeddingId: 'missing', chunkId: 'cX', sourceId: 'sX', text: 't' }] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });

  test('insufficient retrieval remains insufficient', () => {
    const retrieval = { status: 'insufficient', evidence: [] };
    const out = assembleTutorEvidence(retrieval, mstore);
    expect(out.status).toBe('insufficient');
  });
});

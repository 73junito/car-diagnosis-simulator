const MockProvider = require('../src/embeddings/mockProvider');
const MemoryVectorStore = require('../src/embeddings/vectorStoreAdapter');
const MemoryMetadataStore = require('../src/embeddings/memoryStorageAdapter');
const { cosineSimilarity, retrieveApprovedEvidence } = require('../src/retrieval/retriever');
const crypto = require('crypto');

function sha(text) { return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex'); }

describe('retrieval - Top-K approved evidence', () => {
  let provider, vstore, mstore;
  beforeEach(() => {
    provider = new MockProvider({ model: 'mock-1', dimensions: 8, embeddingVersion: 'v1' });
    vstore = new MemoryVectorStore();
    mstore = new MemoryMetadataStore();
  });

  test('cosineSimilarity basics', () => {
    expect(cosineSimilarity([1,0],[0,1])).toBeCloseTo(0);
    expect(cosineSimilarity([1,0],[1,0])).toBeCloseTo(1);
    expect(cosineSimilarity([1,1],[1,1])).toBeCloseTo(1);
  });

  test('highest scoring approved chunk returned first', async () => {
    // create two chunks with vectors
    const rec1 = { id: 'e1', chunkId: 'c1', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', text: 'apple' };
    const rec2 = { id: 'e2', chunkId: 'c2', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', text: 'banana' };
    await mstore.upsert(rec1);
    await mstore.upsert(rec2);
    const v1 = (await provider.embedTexts(['apple'])).vectors[0];
    const v2 = (await provider.embedTexts(['banana'])).vectors[0];
    await vstore.insertVector('e1', v1);
    await vstore.insertVector('e2', v2);

    const res = await retrieveApprovedEvidence({ query: 'apple', provider, vectorStore: vstore, metadataStore: mstore, topK: 2, minScore: 0 });
    expect(res.status).toBe('sufficient');
    expect(res.evidence[0].chunkId).toBe('c1');
    expect(res.evidence[0].citationLabel).toBe('C1');
  });

  test('draft source excluded', async () => {
    const rec = { id: 'e3', chunkId: 'c3', sourceId: 's2', sourceStatus: 'draft', chunkStatus: 'approved', text: 'x' };
    await mstore.upsert(rec);
    const v = (await provider.embedTexts(['x'])).vectors[0];
    await vstore.insertVector('e3', v);
    const res = await retrieveApprovedEvidence({ query: 'x', provider, vectorStore: vstore, metadataStore: mstore, topK: 1, minScore: 0 });
    expect(res.status).toBe('insufficient');
  });

  test('retired source excluded', async () => {
    const rec = { id: 'e4', chunkId: 'c4', sourceId: 's3', sourceStatus: 'approved', sourceRetired: true, chunkStatus: 'approved', text: 'y' };
    await mstore.upsert(rec);
    const v = (await provider.embedTexts(['y'])).vectors[0];
    await vstore.insertVector('e4', v);
    const res = await retrieveApprovedEvidence({ query: 'y', provider, vectorStore: vstore, metadataStore: mstore, topK: 1, minScore: 0 });
    expect(res.status).toBe('insufficient');
  });

  test('superseded source excluded', async () => {
    const rec = { id: 'e5', chunkId: 'c5', sourceId: 's4', sourceStatus: 'approved', sourceSuperseded_by: 's5', chunkStatus: 'approved', text: 'z' };
    await mstore.upsert(rec);
    const v = (await provider.embedTexts(['z'])).vectors[0];
    await vstore.insertVector('e5', v);
    const res = await retrieveApprovedEvidence({ query: 'z', provider, vectorStore: vstore, metadataStore: mstore, topK: 1, minScore: 0 });
    expect(res.status).toBe('insufficient');
  });

  test('draft chunk excluded and superseded chunk excluded', async () => {
    const a = { id: 'ea', chunkId: 'ca', sourceStatus: 'approved', chunkStatus: 'draft', text: 'a' };
    const b = { id: 'eb', chunkId: 'cb', sourceStatus: 'approved', chunkStatus: 'approved', chunkSuperseded_by: 'cb2', text: 'b' };
    await mstore.upsert(a); await mstore.upsert(b);
    await vstore.insertVector('ea', (await provider.embedTexts(['a'])).vectors[0]);
    await vstore.insertVector('eb', (await provider.embedTexts(['b'])).vectors[0]);
    const res = await retrieveApprovedEvidence({ query: 'a', provider, vectorStore: vstore, metadataStore: mstore, topK: 5, minScore: 0 });
    expect(res.status).toBe('insufficient');
  });

  test('superseded embedding excluded', async () => {
    const good = { id: 'eg1', chunkId: 'cg', sourceStatus: 'approved', chunkStatus: 'approved', text: 'g' };
    const old = { id: 'eg0', chunkId: 'cg', sourceStatus: 'approved', chunkStatus: 'approved', superseded_by: 'eg1', text: 'g-old' };
    await mstore.upsert(old);
    await mstore.upsert(good);
    await vstore.insertVector('eg1', (await provider.embedTexts(['g'])).vectors[0]);
    await vstore.insertVector('eg0', (await provider.embedTexts(['g-old'])).vectors[0]);
    const res = await retrieveApprovedEvidence({ query: 'g', provider, vectorStore: vstore, metadataStore: mstore, topK: 5, minScore: 0 });
    expect(res.status).toBe('sufficient');
    expect(res.evidence[0].embeddingId).toBe('eg1');
  });

  test('duplicate chunk IDs collapsed and topK enforced', async () => {
    const r1 = { id: 'd1', chunkId: 'dup', sourceStatus: 'approved', chunkStatus: 'approved', text: 'one' };
    const r2 = { id: 'd2', chunkId: 'dup', sourceStatus: 'approved', chunkStatus: 'approved', text: 'two' };
    await mstore.upsert(r1); await mstore.upsert(r2);
    await vstore.insertVector('d1', (await provider.embedTexts(['one'])).vectors[0]);
    await vstore.insertVector('d2', (await provider.embedTexts(['two'])).vectors[0]);
    const res = await retrieveApprovedEvidence({ query: 'one', provider, vectorStore: vstore, metadataStore: mstore, topK: 5, minScore: 0 });
    expect(res.status).toBe('sufficient');
    // only one result for chunk 'dup'
    expect(res.evidence.length).toBe(1);
  });

  test('minScore enforced and no qualifying evidence returns fail-closed', async () => {
    const r = { id: 'm1', chunkId: 'cmin', sourceStatus: 'approved', chunkStatus: 'approved', text: 'm' };
    await mstore.upsert(r);
    await vstore.insertVector('m1', (await provider.embedTexts(['m'])).vectors[0]);
    const res = await retrieveApprovedEvidence({ query: 'unrelated', provider, vectorStore: vstore, metadataStore: mstore, topK: 5, minScore: 0.99 });
    expect(res.status).toBe('insufficient');
    expect(res.reason).toBe('NO_APPROVED_EVIDENCE_ABOVE_THRESHOLD');
  });

  test('empty query rejected', async () => {
    await expect(retrieveApprovedEvidence({ query: '', provider, vectorStore: vstore, metadataStore: mstore })).rejects.toThrow(/empty query/);
  });

  test('vector dimension mismatch rejected', async () => {
    // make provider produce vector length 8; insert a vector of length 4
    const r = { id: 'mm', chunkId: 'mmc', sourceStatus: 'approved', chunkStatus: 'approved', text: 'mm' };
    await mstore.upsert(r);
    await vstore.insertVector('mm', [0,0,0,0]);
    await expect(retrieveApprovedEvidence({ query: 'mm', provider, vectorStore: vstore, metadataStore: mstore })).rejects.toThrow(/dimension/);
  });

  test('citation labels stable and deterministic', async () => {
    const a = { id: 'l1', chunkId: 'cA', sourceStatus: 'approved', chunkStatus: 'approved', text: 'alpha' };
    const b = { id: 'l2', chunkId: 'cB', sourceStatus: 'approved', chunkStatus: 'approved', text: 'beta' };
    await mstore.upsert(a); await mstore.upsert(b);
    await vstore.insertVector('l1', (await provider.embedTexts(['alpha'])).vectors[0]);
    await vstore.insertVector('l2', (await provider.embedTexts(['beta'])).vectors[0]);
    const res = await retrieveApprovedEvidence({ query: 'alpha', provider, vectorStore: vstore, metadataStore: mstore, topK: 2, minScore: 0 });
    expect(res.evidence[0].citationLabel).toBe('C1');
    expect(res.evidence[1].citationLabel).toBe('C2');
  });
});

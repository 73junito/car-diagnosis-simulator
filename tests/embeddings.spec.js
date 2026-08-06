const MockProvider = require('../src/embeddings/mockProvider');
const MemoryStorageAdapter = require('../src/embeddings/memoryStorageAdapter');
const { embedChunks, eligibleChunks, isChunkEmbeddable, buildEmbeddingRecord } = require('../src/embeddings/embedder');
const crypto = require('crypto');

function sha(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }

describe('embeddings pipeline prototype', () => {
  let provider; let storage; let source;
  beforeEach(() => {
    provider = new MockProvider({ model: 'mock-1', dimensions: 6, embeddingVersion: 'v1' });
    storage = new MemoryStorageAdapter();
    source = { id: 's1', status: 'approved', version: 1 };
  });

  test('draft chunks excluded', async () => {
    const chunks = [{ id: 'c1', status: 'draft', approved: false, text_excerpt: 'foo', text_hash: sha('foo') }];
    const eligible = eligibleChunks(chunks, source);
    expect(eligible.length).toBe(0);
  });

  test('retired source excluded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'foo', text_hash: sha('foo') }];
    const retired = { ...source, retired: true };
    const eligible = eligibleChunks(chunks, retired);
    expect(eligible.length).toBe(0);
    expect(isChunkEmbeddable({ source: retired, chunk: chunks[0] })).toBe(false);
  });

  test('superseded source excluded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'bar', text_hash: sha('bar') }];
    const s = { ...source, superseded_by: 's2' };
    expect(isChunkEmbeddable({ source: s, chunk: chunks[0] })).toBe(false);
  });

  test('approved chunk accepted and embedded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'alpha', text_hash: sha('alpha') }];
    const r = await embedChunks({ provider, storage, source, chunks });
    expect(r.embedded.length).toBe(1);
    expect(r.embedded[0].chunkId).toBe('c1');
    expect(r.embedded[0].embeddingHash).toBeDefined();
  });

  test('unchanged chunks skipped', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'beta', text_hash: sha('beta') }];
    // prepopulate storage
    const pre = { chunkHash: sha('beta'), model: 'mock-1', dimensions: 6, embeddingVersion: 'v1', vector: [0,0,0,0,0,0] };
    await storage.upsert(pre);
    const r = await embedChunks({ provider, storage, source, chunks });
    expect(r.embedded.length).toBe(0);
    expect(r.skipped).toBe(1);
  });

  test('changed chunk hash re-embedded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'gamma', text_hash: sha('gamma') }];
    const r1 = await embedChunks({ provider, storage, source, chunks });
    expect(r1.embedded.length).toBe(1);
    // change chunk hash (simulate update)
    chunks[0].text_excerpt = 'gamma modified';
    chunks[0].text_hash = sha('gamma modified');
    const r2 = await embedChunks({ provider, storage, source, chunks });
    expect(r2.embedded.length).toBe(1);
  });

  test('changed model re-embedded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'delta', text_hash: sha('delta') }];
    const r1 = await embedChunks({ provider, storage, source, chunks });
    expect(r1.embedded.length).toBe(1);
    // new model
    const provider2 = new MockProvider({ model: 'mock-2', dimensions: 6, embeddingVersion: 'v1' });
    const r2 = await embedChunks({ provider: provider2, storage, source, chunks, options: { model: 'mock-2' } });
    expect(r2.embedded.length).toBe(1);
  });

  test('provider dimension mismatch rejected', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'epsilon', text_hash: sha('epsilon') }];
    // provider that ignores requested dimensions and returns 4
    const badProvider = {
      getMetadata: () => ({ model: 'mock-1', dimensions: 4, embeddingVersion: 'v1' }),
      embedTexts: async (texts, opts) => ({ model: 'mock-1', dimensions: 4, embeddingVersion: 'v1', vectors: texts.map(() => [0,0,0,0]) })
    };
    // request dimensions 6 but provider returns 4 => should throw
    await expect(embedChunks({ provider: badProvider, storage, source, chunks, options: { dimensions: 6 } })).rejects.toThrow(/dimension/);
  });

  test('empty chunk text excluded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: '', text_hash: sha('') }];
    const r = await embedChunks({ provider, storage, source, chunks });
    expect(r.embedded.length).toBe(0);
    expect(r.skipped).toBe(0);
  });

  test('deleted or superseded chunk excluded', async () => {
    const c1 = { id: 'c1', status: 'approved', approved: true, text_excerpt: 'keep', text_hash: sha('keep') };
    const c2 = { id: 'c2', status: 'approved', approved: true, text_excerpt: 'del', text_hash: sha('del'), deleted: true };
    const c3 = { id: 'c3', status: 'approved', approved: true, text_excerpt: 'sup', text_hash: sha('sup'), superseded_by: 'c3b' };
    expect(isChunkEmbeddable({ source, chunk: c1 })).toBe(true);
    expect(isChunkEmbeddable({ source, chunk: c2 })).toBe(false);
    expect(isChunkEmbeddable({ source, chunk: c3 })).toBe(false);
  });

  test('changed chunk creates second record and prior is superseded', async () => {
    const chunks = [{ id: 'c1', status: 'approved', approved: true, text_excerpt: 'gamma', text_hash: sha('gamma') }];
    const r1 = await embedChunks({ provider, storage, source, chunks });
    expect(r1.embedded.length).toBe(1);
    const recordsAfter1 = storage.all();
    expect(recordsAfter1.length).toBeGreaterThanOrEqual(1);

    // modify chunk
    chunks[0].text_excerpt = 'gamma modified';
    chunks[0].text_hash = sha('gamma modified');
    const r2 = await embedChunks({ provider, storage, source, chunks });
    expect(r2.embedded.length).toBe(1);

    const all = storage.all();
    // should have at least two historical records across keys
    expect(all.length).toBeGreaterThanOrEqual(recordsAfter1.length + 1 - 0);

    // find prior and new by chunkId
    const byChunk = all.filter(x => x.chunkId === 'c1');
    expect(byChunk.length).toBeGreaterThanOrEqual(2);
    const newest = byChunk[byChunk.length - 1];
    const prior = byChunk[byChunk.length - 2];
    expect(prior.superseded_by).toBeDefined();
    expect(prior.superseded_by).toBe(newest.id);
    // latest findByKeys should return newest for the new chunkHash/model/version
    const found = await storage.findByKeys({ chunkHash: newest.chunkHash, model: newest.model, dimensions: newest.dimensions, embeddingVersion: newest.embeddingVersion });
    expect(found.id).toBe(newest.id);
  });
});

const MockProvider = require('../src/embeddings/mockProvider');
const MemoryVectorStore = require('../src/embeddings/vectorStoreAdapter');
const MemoryMetadataStore = require('../src/embeddings/memoryStorageAdapter');
const { vectorRetrieve } = require('../src/retrieval/vectorRetriever');
const { keywordRetrieve } = require('../src/retrieval/keywordRetriever');
const { reciprocalRankFusion } = require('../src/retrieval/reciprocalRankFusion');
const { hybridRetrieve } = require('../src/retrieval/hybridRetriever');

describe('hybrid retrieval phase 1', () => {
  let provider;
  let vectorStore;
  let metadataStore;

  beforeEach(() => {
    provider = new MockProvider({ model: 'mock-1', dimensions: 8, embeddingVersion: 'v1' });
    vectorStore = new MemoryVectorStore();
    metadataStore = new MemoryMetadataStore();
  });

  async function seed(rec, vectorText) {
    await metadataStore.upsert(rec);
    const v = (await provider.embedTexts([vectorText || rec.text || 'x'])).vectors[0];
    await vectorStore.insertVector(rec.id, v);
  }

  test('vector retriever returns approved active records only', async () => {
    await seed({ id: 'e1', chunkId: 'c1', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', text: 'starter relay control circuit' }, 'starter relay control circuit');
    await seed({ id: 'e2', chunkId: 'c2', sourceId: 's2', sourceStatus: 'draft', chunkStatus: 'approved', text: 'draft evidence' }, 'draft evidence');

    const out = await vectorRetrieve({
      query: 'starter relay',
      provider,
      vectorStore,
      metadataStore,
      topK: 10,
      minScore: 0
    });

    expect(out.length).toBe(1);
    expect(out[0].chunkId).toBe('c1');
  });

  test('keyword retriever BM25 prefers stronger lexical match', async () => {
    await metadataStore.upsert({ id: 'k1', chunkId: 'kc1', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', text: 'starter relay starter relay circuit test' });
    await metadataStore.upsert({ id: 'k2', chunkId: 'kc2', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', text: 'battery cable inspection' });

    const out = await keywordRetrieve({ query: 'starter relay', metadataStore, topK: 5, minScore: 0 });
    expect(out.length).toBe(2);
    expect(out[0].chunkId).toBe('kc1');
    expect(out[0].keywordScore).toBeGreaterThan(out[1].keywordScore);
  });

  test('reciprocal rank fusion combines rankings deterministically', () => {
    const vec = [
      { chunkId: 'A', embeddingId: 'vA' },
      { chunkId: 'B', embeddingId: 'vB' }
    ];
    const kw = [
      { chunkId: 'B', embeddingId: 'kB' },
      { chunkId: 'A', embeddingId: 'kA' }
    ];

    const fused = reciprocalRankFusion([vec, kw], { k: 60 });
    expect(fused[0].chunkId).toBe('A');
    expect(fused[1].chunkId).toBe('B');
    expect(fused[0].fusedScore).toBeCloseTo(fused[1].fusedScore, 6);
  });

  test('hybrid retriever returns fused candidate set with labels', async () => {
    await seed({ id: 'h1', chunkId: 'hc1', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', locator: 'Starting System > Circuit', pageStart: 118, pageEnd: 121, text: 'starter relay control circuit check' }, 'starter relay control circuit check');
    await seed({ id: 'h2', chunkId: 'hc2', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', locator: 'Battery > Load Test', pageStart: 44, pageEnd: 45, text: 'battery load test and voltage drop' }, 'battery load test and voltage drop');

    const out = await hybridRetrieve({
      query: 'starter relay control circuit',
      provider,
      vectorStore,
      metadataStore,
      topK: 2
    });

    expect(out.status).toBe('sufficient');
    expect(out.candidates.length).toBe(2);
    expect(out.candidates[0].citationLabel).toBe('C1');
    expect(out.candidates[1].citationLabel).toBe('C2');
    expect(out.candidates[0].chunkId).toBe('hc1');
  });

  test('hybrid retriever fail-closes when no approved evidence found', async () => {
    await metadataStore.upsert({ id: 'x1', chunkId: 'x1', sourceId: 'sX', sourceStatus: 'draft', chunkStatus: 'approved', text: 'ignored draft source' });

    const out = await hybridRetrieve({
      query: 'starter relay',
      provider,
      vectorStore,
      metadataStore,
      topK: 3
    });

    expect(out.status).toBe('insufficient');
    expect(out.reason).toBe('NO_APPROVED_EVIDENCE_ABOVE_THRESHOLD');
    expect(out.candidates).toEqual([]);
  });

  test('hybrid retriever dedupes same chunk across ranking sources', async () => {
    await seed({ id: 'd1', chunkId: 'dup-1', sourceId: 's1', sourceStatus: 'approved', chunkStatus: 'approved', text: 'starter relay starter relay' }, 'starter relay');

    const out = await hybridRetrieve({
      query: 'starter relay',
      provider,
      vectorStore,
      metadataStore,
      topK: 5
    });

    expect(out.status).toBe('sufficient');
    expect(out.candidates.length).toBe(1);
    expect(out.candidates[0].chunkId).toBe('dup-1');
  });
});

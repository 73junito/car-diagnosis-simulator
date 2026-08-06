const { vectorRetrieve } = require('./vectorRetriever');
const { keywordRetrieve } = require('./keywordRetriever');
const { reciprocalRankFusion } = require('./reciprocalRankFusion');

async function hybridRetrieve({
  query,
  provider,
  vectorStore,
  metadataStore,
  topK = 5,
  vectorTopK = 20,
  keywordTopK = 20,
  vectorMinScore = 0,
  keywordMinScore = 0,
  rrfK = 60
}) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) throw new Error('empty query rejected');

  const [vectorRanked, keywordRanked] = await Promise.all([
    vectorRetrieve({ query, provider, vectorStore, metadataStore, topK: vectorTopK, minScore: vectorMinScore }),
    keywordRetrieve({ query, metadataStore, topK: keywordTopK, minScore: keywordMinScore })
  ]);

  const fused = reciprocalRankFusion([vectorRanked, keywordRanked], { k: rrfK }).slice(0, topK);
  if (fused.length === 0) {
    return {
      status: 'insufficient',
      candidates: [],
      reason: 'NO_APPROVED_EVIDENCE_ABOVE_THRESHOLD'
    };
  }

  const candidates = fused.map((x, i) => ({
    citationLabel: `C${i + 1}`,
    fusedScore: x.fusedScore,
    vectorScore: x.vectorScore || 0,
    keywordScore: x.keywordScore || 0,
    chunkId: x.chunkId || null,
    sourceId: x.sourceId || null,
    sourceVersion: x.sourceVersion || null,
    section: x.section || null,
    locator: x.locator || null,
    pageStart: x.pageStart || null,
    pageEnd: x.pageEnd || null,
    text: x.text || null,
    embeddingId: x.embeddingId || null,
    rankSignals: x.rankSignals || []
  }));

  return {
    status: 'sufficient',
    candidates
  };
}

module.exports = { hybridRetrieve };

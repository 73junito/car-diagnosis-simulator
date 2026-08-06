const { vectorRetrieve } = require('./vectorRetriever');
const { keywordRetrieve } = require('./keywordRetriever');
const { reciprocalRankFusion } = require('./reciprocalRankFusion');
const { createRetrievalContext, withContext } = require('./retrievalContext');
const { identityRankingStrategy } = require('./rankingStrategy');

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
  rrfK = 60,
  rankingStrategy = identityRankingStrategy
}) {
  const context = createRetrievalContext({ query, provider, vectorStore, metadataStore, topK, minScore: 0, requireVectorStore: true });

  const qRes = await provider.embedTexts([context.query]);
  const queryEmbedding = qRes && qRes.vectors && qRes.vectors[0];
  const vectorContext = withContext(context, {
    queryEmbedding,
    topK: vectorTopK,
    minScore: vectorMinScore
  });
  const keywordContext = withContext(context, {
    topK: keywordTopK,
    minScore: keywordMinScore
  });

  const [vectorRanked, keywordRanked] = await Promise.all([
    vectorRetrieve(vectorContext),
    keywordRetrieve(keywordContext)
  ]);

  const fused = reciprocalRankFusion([vectorRanked, keywordRanked], { k: rrfK });
  const ranked = (rankingStrategy && typeof rankingStrategy.rank === 'function')
    ? rankingStrategy.rank(fused, context.query, context)
    : identityRankingStrategy.rank(fused, context.query, context);
  const finalCandidates = ranked.slice(0, topK);

  if (finalCandidates.length === 0) {
    return {
      status: 'insufficient',
      candidates: [],
      reason: 'NO_APPROVED_EVIDENCE_ABOVE_THRESHOLD'
    };
  }

  const candidates = finalCandidates.map((x, i) => ({
    citationLabel: `C${i + 1}`,
    score: x.score,
    fusionScore: x.fusionScore,
    vectorScore: x.vectorScore || 0,
    lexicalScore: x.lexicalScore || 0,
    retrievalMethod: x.retrievalMethod,
    chunkId: x.chunkId || null,
    sourceId: x.sourceId || null,
    metadata: x.metadata || {}
  }));

  return {
    status: 'sufficient',
    candidates
  };
}

module.exports = { hybridRetrieve };

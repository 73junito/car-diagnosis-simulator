function createCandidate({
  chunkId,
  sourceId,
  score,
  vectorScore = 0,
  lexicalScore = 0,
  fusionScore = 0,
  retrievalMethod,
  metadata = {}
}) {
  return {
    chunkId: chunkId || null,
    sourceId: sourceId || null,
    score: Number((score || 0).toFixed(8)),
    vectorScore: Number((vectorScore || 0).toFixed(8)),
    lexicalScore: Number((lexicalScore || 0).toFixed(8)),
    fusionScore: Number((fusionScore || 0).toFixed(8)),
    retrievalMethod: retrievalMethod || 'unknown',
    metadata: {
      embeddingId: metadata.embeddingId || null,
      sourceVersion: metadata.sourceVersion || null,
      section: metadata.section || null,
      locator: metadata.locator || null,
      pageStart: metadata.pageStart || null,
      pageEnd: metadata.pageEnd || null,
      text: metadata.text || null,
      rankSignals: Array.isArray(metadata.rankSignals) ? metadata.rankSignals.slice() : []
    }
  };
}

module.exports = {
  createCandidate
};

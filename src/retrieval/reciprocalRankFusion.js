const { createCandidate } = require('./candidateShape');

function reciprocalRankFusion(lists, { k = 60 } = {}) {
  if (!Array.isArray(lists)) throw new Error('lists must be an array');

  const byKey = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item) continue;
      const key = item.chunkId || item.embeddingId;
      if (!key) continue;
      const rank = i + 1;
      const contribution = 1 / (k + rank);

      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          fusedScore: 0,
          rankSignals: [],
          item: item,
          vectorScore: 0,
          lexicalScore: 0
        });
      }

      const row = byKey.get(key);
      row.fusedScore += contribution;
      row.rankSignals.push(rank);
      row.vectorScore = Math.max(row.vectorScore, item.vectorScore || 0);
      row.lexicalScore = Math.max(row.lexicalScore, item.lexicalScore || 0);

      // Keep the richer representation if available.
      if ((item.text && !row.item.text) || (item.locator && !row.item.locator)) {
        row.item = item;
      }
    }
  }

  return Array.from(byKey.values())
    .map(r => ({
      ...createCandidate({
        chunkId: r.item.chunkId,
        sourceId: r.item.sourceId,
        score: r.fusedScore,
        vectorScore: r.vectorScore,
        lexicalScore: r.lexicalScore,
        fusionScore: r.fusedScore,
        retrievalMethod: 'fusion',
        metadata: {
          ...(r.item.metadata || {}),
          rankSignals: r.rankSignals.slice().sort((a, b) => a - b)
        }
      })
    }))
    .sort((a, b) => b.fusionScore - a.fusionScore || String(a.chunkId).localeCompare(String(b.chunkId)));
}

module.exports = { reciprocalRankFusion };

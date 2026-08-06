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
          item: item
        });
      }

      const row = byKey.get(key);
      row.fusedScore += contribution;
      row.rankSignals.push(rank);

      // Keep the richer representation if available.
      if ((item.text && !row.item.text) || (item.locator && !row.item.locator)) {
        row.item = item;
      }
    }
  }

  return Array.from(byKey.values())
    .map(r => ({
      ...r.item,
      fusedScore: Number(r.fusedScore.toFixed(8)),
      rankSignals: r.rankSignals.slice().sort((a, b) => a - b)
    }))
    .sort((a, b) => b.fusedScore - a.fusedScore || String(a.chunkId || a.embeddingId).localeCompare(String(b.chunkId || b.embeddingId)));
}

module.exports = { reciprocalRankFusion };

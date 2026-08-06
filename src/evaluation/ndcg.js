function discount(rank) {
  return 1 / Math.log2(rank + 1);
}

function ndcgAtK(relevantChunkIds, retrievedChunkIds, k) {
  const relevant = Array.isArray(relevantChunkIds) ? relevantChunkIds : [];
  const retrieved = Array.isArray(retrievedChunkIds) ? retrievedChunkIds.slice(0, k) : [];
  if (relevant.length === 0) throw new Error('relevantChunkIds must not be empty');

  const relevantSet = new Set(relevant);
  const credited = new Set();
  let dcg = 0;
  for (let i = 0; i < retrieved.length; i++) {
    const id = retrieved[i];
    if (relevantSet.has(id) && !credited.has(id)) {
      credited.add(id);
      dcg += discount(i + 1);
    }
  }

  const idealHits = Math.min(relevant.length, k);
  let idcg = 0;
  for (let i = 1; i <= idealHits; i++) {
    idcg += discount(i);
  }

  if (idcg === 0) return 0;
  return dcg / idcg;
}

module.exports = {
  ndcgAtK
};

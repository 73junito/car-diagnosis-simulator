function recallAtK(relevantChunkIds, retrievedChunkIds, k) {
  const relevant = Array.isArray(relevantChunkIds) ? relevantChunkIds : [];
  const retrieved = Array.isArray(retrievedChunkIds) ? retrievedChunkIds.slice(0, k) : [];
  if (relevant.length === 0) throw new Error('relevantChunkIds must not be empty');

  const relevantSet = new Set(relevant);
  const counted = new Set();
  let hits = 0;
  for (const id of retrieved) {
    if (relevantSet.has(id) && !counted.has(id)) {
      counted.add(id);
      hits += 1;
    }
  }
  return hits / relevant.length;
}

module.exports = {
  recallAtK
};

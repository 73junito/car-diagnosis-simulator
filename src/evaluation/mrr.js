function reciprocalRank(relevantChunkIds, retrievedChunkIds) {
  const relevant = Array.isArray(relevantChunkIds) ? new Set(relevantChunkIds) : new Set();
  const retrieved = Array.isArray(retrievedChunkIds) ? retrievedChunkIds : [];
  if (relevant.size === 0) throw new Error('relevantChunkIds must not be empty');

  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

module.exports = {
  reciprocalRank
};

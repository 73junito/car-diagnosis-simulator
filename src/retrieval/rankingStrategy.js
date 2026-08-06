const identityRankingStrategy = {
  name: 'identity',
  rank(candidates) {
    return Array.isArray(candidates)
      ? candidates.slice().sort((a, b) => b.score - a.score || String(a.chunkId).localeCompare(String(b.chunkId)))
      : [];
  }
};

module.exports = {
  identityRankingStrategy
};

class MemoryVectorStore {
  constructor() {
    this._vectors = new Map(); // embeddingId -> vector
  }

  async insertVector(embeddingId, vector) {
    this._vectors.set(embeddingId, vector);
    return { embeddingId };
  }

  async getVector(embeddingId) {
    return this._vectors.get(embeddingId) || null;
  }

  // test helper
  all() {
    return Array.from(this._vectors.entries()).map(([id, v]) => ({ id, vector: v }));
  }
}

module.exports = MemoryVectorStore;

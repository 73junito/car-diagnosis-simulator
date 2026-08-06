class EmbeddingProvider {
  async embedTexts(texts, options = {}) {
    throw new Error('embedTexts() must be implemented');
  }

  getMetadata() {
    throw new Error('getMetadata() must be implemented');
  }
}

module.exports = EmbeddingProvider;

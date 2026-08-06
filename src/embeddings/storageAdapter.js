class StorageAdapter {
  async findByKeys({ chunkHash, model, dimensions, embeddingVersion }) {
    throw new Error('findByKeys() must be implemented');
  }

  async upsert(record) {
    throw new Error('upsert() must be implemented');
  }
}

module.exports = StorageAdapter;

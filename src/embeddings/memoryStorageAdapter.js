class MemoryStorageAdapter {
  constructor() {
    this._store = new Map();
  }

  _key({ chunkHash, model, dimensions, embeddingVersion }) {
    return `${chunkHash}::${model}::${dimensions}::${embeddingVersion}`;
  }

  async findByKeys(keys) {
    const k = this._key(keys);
    return this._store.get(k) || null;
  }

  async upsert(record) {
    const k = this._key(record);
    this._store.set(k, record);
    return record;
  }

  // test helper
  all() { return Array.from(this._store.values()); }
}

module.exports = MemoryStorageAdapter;

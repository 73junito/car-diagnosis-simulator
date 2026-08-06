const crypto = require('crypto');

class MemoryStorageAdapter {
  constructor() {
    // primary index: key -> array of records (history)
    this._store = new Map();
    // map chunkId -> array of records (history)
    this._byChunkId = new Map();
  }

  _key({ chunkHash, model, dimensions, embeddingVersion }) {
    return `${chunkHash}::${model}::${dimensions}::${embeddingVersion}`;
  }

  // return latest non-superseded record for the given keys
  async findByKeys(keys) {
    const k = this._key(keys);
    const arr = this._store.get(k) || [];
    // find the newest record that is not superseded
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!arr[i].superseded_by) return arr[i];
    }
    return null;
  }

  // append-only insert: never overwrite an existing record
  // If there's an existing active record for the same chunkId, mark it superseded
  async upsert(record) {
    // ensure id
    if (!record.id) {
      record.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    const k = this._key(record);
    const arr = this._store.get(k) || [];
    arr.push(record);
    this._store.set(k, arr);

    if (record.chunkId) {
      const byChunk = this._byChunkId.get(record.chunkId) || [];
      // mark prior active as superseded
      for (let i = byChunk.length - 1; i >= 0; i--) {
        const prev = byChunk[i];
        if (!prev.superseded_by) {
          prev.superseded_by = record.id;
          break;
        }
      }
      byChunk.push(record);
      this._byChunkId.set(record.chunkId, byChunk);
    }

    return record;
  }

  // test helper: list all records
  all() {
    const out = [];
    for (const arr of this._store.values()) out.push(...arr);
    return out;
  }
}

module.exports = MemoryStorageAdapter;

// Minimal checkpoint store interface and an in-memory store implementation.
// Exports a factory for an in-memory store to be used in tests or as a fallback.
class MemoryCheckpointStore {
  constructor() {
    this._map = new Map();
  }
  async get(key) {
    return this._map.has(key) ? this._map.get(key) : undefined;
  }
  async set(key, value) {
    this._map.set(key, value);
    return true;
  }
  async has(key) {
    return this._map.has(key);
  }
  async delete(key) {
    return this._map.delete(key);
  }
  async clear() {
    this._map.clear();
    return true;
  }
}

function createMemoryStore() {
  return new MemoryCheckpointStore();
}

module.exports = { createMemoryStore, MemoryCheckpointStore };

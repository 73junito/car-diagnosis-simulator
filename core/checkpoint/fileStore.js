const fs = require('fs');
const path = require('path');

class FileCheckpointStore {
  constructor(filePath, options = {}) {
    this.filePath = path.resolve(process.cwd(), filePath || '.checkpoints/checkpoints.json');
    this.tmpPath = this.filePath + '.tmp';
    this._data = {};
    this._loaded = false;
    this.options = options;
  }

  async _ensureDir() {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }

  async _load() {
    if (this._loaded) return;
    try {
      const txt = await fs.promises.readFile(this.filePath, 'utf8');
      this._data = JSON.parse(txt || '{}');
    } catch (e) {
      this._data = {};
    }
    this._loaded = true;
  }

  async _persist() {
    await this._ensureDir();
    const tmp = this.tmpPath;
    const data = JSON.stringify(this._data, null, 2);
    await fs.promises.writeFile(tmp, data, 'utf8');
    await fs.promises.rename(tmp, this.filePath);
  }

  async get(key) {
    await this._load();
    return this._data.hasOwnProperty(key) ? this._data[key] : undefined;
  }

  async set(key, value) {
    await this._load();
    this._data[key] = value;
    await this._persist();
    return true;
  }

  async has(key) {
    await this._load();
    return this._data.hasOwnProperty(key);
  }

  async delete(key) {
    await this._load();
    if (this._data.hasOwnProperty(key)) {
      delete this._data[key];
      await this._persist();
      return true;
    }
    return false;
  }

  async clear() {
    this._data = {};
    await this._persist();
    return true;
  }
}

module.exports = FileCheckpointStore;

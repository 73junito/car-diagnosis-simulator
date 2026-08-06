const crypto = require('crypto');
const EmbeddingProvider = require('./embeddingProvider');

class MockProvider extends EmbeddingProvider {
  constructor({ model = 'mock-1', dimensions = 8, embeddingVersion = 'v1' } = {}) {
    super();
    this._model = model;
    this._dimensions = dimensions;
    this._embeddingVersion = embeddingVersion;
  }

  getMetadata() {
    return { model: this._model, dimensions: this._dimensions, embeddingVersion: this._embeddingVersion };
  }

  async embedTexts(texts, options = {}) {
    const dims = options.dimensions || this._dimensions;
    const model = options.model || this._model;
    const vectors = texts.map((t) => deterministicVector(t, dims));
    return { model, dimensions: dims, embeddingVersion: this._embeddingVersion, vectors };
  }
}

function deterministicVector(text, dims) {
  // derive a deterministic seed from text and produce floats in [-1,1]
  const hash = crypto.createHash('sha256').update(text, 'utf8').digest();
  const vec = new Array(dims).fill(0).map((_, i) => {
    // map two bytes into a signed 16-bit int then to [-1,1]
    const idx = (i * 2) % hash.length;
    const v = (hash[idx] << 8) | hash[idx + 1];
    // signed
    const signed = v > 0x7fff ? v - 0x10000 : v;
    return Number((signed / 32768).toFixed(6));
  });
  return vec;
}

module.exports = MockProvider;

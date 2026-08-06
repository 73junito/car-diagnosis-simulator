const crypto = require('crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function buildEmbeddingRecord({ chunk, source, model, dimensions, embeddingVersion, vector }) {
  const embeddingHash = sha256Hex(JSON.stringify(vector));
  return {
    id: crypto.randomUUID(),
    chunkId: chunk.id || chunk.chunk_id || null,
    sourceId: source.id || null,
    sourceVersion: source.version || null,
    chunkHash: chunk.text_hash || chunk.chunkHash || null,
    model,
    dimensions,
    embeddingVersion,
    vector,
    embeddingHash,
    createdAt: new Date().toISOString()
  };
}

function isChunkEmbeddable({ source, chunk }) {
  return (
    source?.status === 'approved' &&
    source?.retired !== true &&
    source?.superseded_by == null &&
    chunk?.status === 'approved' &&
    chunk?.approved === true &&
    chunk?.deleted !== true &&
    chunk?.superseded_by == null &&
    typeof chunk?.text_excerpt === 'string' &&
    chunk.text_excerpt.trim().length > 0
  );
}

function eligibleChunks(chunks, source) {
  return chunks.filter(c => isChunkEmbeddable({ source, chunk: c }));
}

async function embedChunks({ provider, storage, source, chunks, options = {} }) {
  const eligible = eligibleChunks(chunks, source);
  const metadata = provider.getMetadata();
  const model = options.model || metadata.model;
  const dimensions = options.dimensions || metadata.dimensions;
  const embeddingVersion = options.embeddingVersion || metadata.embeddingVersion;

  const texts = eligible.map(c => c.text_excerpt || c.text || '');
  // validate input texts
  for (const t of texts) {
    if (!t || typeof t !== 'string' || t.trim().length === 0) throw new Error('empty chunk text rejected');
  }

  // determine which need embedding
  const toEmbed = [];
  for (const c of eligible) {
    const existing = await storage.findByKeys({ chunkHash: c.text_hash || c.chunkHash, model, dimensions, embeddingVersion });
    if (existing) continue; // skip unchanged
    toEmbed.push(c);
  }

  if (toEmbed.length === 0) return { embedded: [], skipped: eligible.length };

  const textsToEmbed = toEmbed.map(c => c.text_excerpt || c.text || '');
  const res = await provider.embedTexts(textsToEmbed, { model, dimensions });
  if (!res || !Array.isArray(res.vectors)) throw new Error('provider returned invalid vectors');
  if (res.dimensions !== dimensions) throw new Error('provider dimension mismatch');

  const records = [];
  for (let i = 0; i < toEmbed.length; i++) {
    const chunk = toEmbed[i];
    const vector = res.vectors[i];
    const record = buildEmbeddingRecord({ chunk, source, model, dimensions, embeddingVersion, vector });
    // write metadata (append-only) using available API
    if (storage && typeof storage.insertMetadata === 'function') {
      await storage.insertMetadata(record);
    } else if (storage && typeof storage.upsert === 'function') {
      await storage.upsert(record);
    } else {
      throw new Error('no metadata storage available');
    }

    // write vector to vector store if available (separation of concerns)
    if (storage && typeof storage.insertVector === 'function') {
      await storage.insertVector(record.id, vector);
    } else if (storage && storage.vectorStore && typeof storage.vectorStore.insertVector === 'function') {
      await storage.vectorStore.insertVector(record.id, vector);
    }
    records.push(record);
  }

  return { embedded: records, skipped: eligible.length - toEmbed.length };
}

module.exports = { buildEmbeddingRecord, eligibleChunks, embedChunks, isChunkEmbeddable };

const { cosineSimilarity } = require('./retriever');

function isApprovedActiveRecord(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (rec.superseded_by) return false;
  if (rec.sourceStatus && rec.sourceStatus !== 'approved') return false;
  if (rec.sourceRetired) return false;
  if (rec.sourceSuperseded_by) return false;
  if (rec.chunkStatus && rec.chunkStatus !== 'approved') return false;
  if (rec.chunkDeleted) return false;
  if (rec.chunkSuperseded_by) return false;
  return true;
}

function toCandidate(rec, score) {
  return {
    embeddingId: rec.id || null,
    chunkId: rec.chunkId || rec.chunk_id || null,
    sourceId: rec.sourceId || null,
    sourceVersion: rec.sourceVersion || null,
    section: rec.section || null,
    locator: rec.locator || null,
    pageStart: rec.pageStart || null,
    pageEnd: rec.pageEnd || null,
    text: rec.text || rec.text_excerpt || null,
    vectorScore: Number(score.toFixed(6))
  };
}

async function vectorRetrieve({ query, provider, vectorStore, metadataStore, topK = 20, minScore = 0 }) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) throw new Error('empty query rejected');
  if (!provider || typeof provider.embedTexts !== 'function') throw new Error('provider required');
  if (!vectorStore || typeof vectorStore.getVector !== 'function') throw new Error('vectorStore required');
  if (!metadataStore || typeof metadataStore.all !== 'function') throw new Error('metadataStore required');

  const qRes = await provider.embedTexts([query]);
  const qVec = qRes && qRes.vectors && qRes.vectors[0];
  if (!Array.isArray(qVec)) throw new Error('provider returned invalid query vector');

  const allMeta = await metadataStore.all();
  const byChunk = new Map();

  for (const rec of allMeta) {
    if (!isApprovedActiveRecord(rec)) continue;

    const vec = await vectorStore.getVector(rec.id);
    if (!Array.isArray(vec)) continue;
    if (vec.length !== qVec.length) throw new Error('vector dimension mismatch');

    const score = cosineSimilarity(qVec, vec);
    if (score < minScore) continue;

    const candidate = toCandidate(rec, score);
    if (!candidate.chunkId) continue;

    const prev = byChunk.get(candidate.chunkId);
    if (!prev || candidate.vectorScore > prev.vectorScore || (candidate.vectorScore === prev.vectorScore && String(candidate.embeddingId).localeCompare(String(prev.embeddingId)) < 0)) {
      byChunk.set(candidate.chunkId, candidate);
    }
  }

  const ranked = Array.from(byChunk.values())
    .sort((a, b) => b.vectorScore - a.vectorScore || String(a.embeddingId).localeCompare(String(b.embeddingId)))
    .slice(0, topK);

  return ranked;
}

module.exports = {
  vectorRetrieve,
  isApprovedActiveRecord
};

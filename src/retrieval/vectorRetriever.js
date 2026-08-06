const { cosineSimilarity } = require('./retriever');
const { createRetrievalContext } = require('./retrievalContext');
const { createCandidate } = require('./candidateShape');

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
  return createCandidate({
    chunkId: rec.chunkId || rec.chunk_id || null,
    sourceId: rec.sourceId || null,
    score,
    vectorScore: score,
    lexicalScore: 0,
    fusionScore: 0,
    retrievalMethod: 'vector',
    metadata: {
      embeddingId: rec.id || null,
      sourceVersion: rec.sourceVersion || null,
      section: rec.section || null,
      locator: rec.locator || null,
      pageStart: rec.pageStart || null,
      pageEnd: rec.pageEnd || null,
      text: rec.text || rec.text_excerpt || null
    }
  });
}

async function retrieve(context) {
  const { query, provider, vectorStore, metadataStore, minScore = 0, topK = 20 } = context;
  if (!vectorStore || typeof vectorStore.getVector !== 'function') throw new Error('vectorStore required');

  const qVec = Array.isArray(context.queryEmbedding)
    ? context.queryEmbedding
    : ((await provider.embedTexts([query])) || {}).vectors?.[0];
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
    if (!prev || candidate.vectorScore > prev.vectorScore || (candidate.vectorScore === prev.vectorScore && String(candidate.metadata.embeddingId).localeCompare(String(prev.metadata.embeddingId)) < 0)) {
      byChunk.set(candidate.chunkId, candidate);
    }
  }

  const ranked = Array.from(byChunk.values())
    .sort((a, b) => b.vectorScore - a.vectorScore || String(a.metadata.embeddingId).localeCompare(String(b.metadata.embeddingId)))
    .slice(0, topK);

  return ranked;
}

async function vectorRetrieve(options) {
  const context = createRetrievalContext({ ...options, requireVectorStore: true });
  return retrieve(context);
}

module.exports = {
  retrieve,
  vectorRetrieve,
  isApprovedActiveRecord
};

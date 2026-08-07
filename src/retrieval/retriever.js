const debug = require('util').debuglog ? require('util').debuglog('retriever') : () => {};
const { validateRetrievedEvidenceRecord } = require('../rala/validators');

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) throw new Error('vectors must be arrays');
  if (a.length !== b.length) throw new Error('dimension mismatch');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function retrieveApprovedEvidence({ query, provider, vectorStore, metadataStore, topK = 5, minScore = 0.5 }) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) throw new Error('empty query rejected');
  if (!provider || typeof provider.embedTexts !== 'function') throw new Error('provider required');
  if (!vectorStore || typeof vectorStore.getVector !== 'function') throw new Error('vectorStore required');
  if (!metadataStore || typeof metadataStore.all !== 'function') throw new Error('metadataStore required');

  // embed the query
  const qRes = await provider.embedTexts([query]);
  const qVec = qRes && qRes.vectors && qRes.vectors[0];
  if (!Array.isArray(qVec)) throw new Error('provider returned invalid query vector');

  const allMeta = await metadataStore.all();
  // filter approved and active records
  const candidates = [];
  for (const rec of allMeta) {
    const recordValidation = validateRetrievedEvidenceRecord(rec);
    if (!recordValidation.ok) continue;

    // skip superseded embedding metadata
    if (rec.superseded_by) continue;
    // require approved source and chunk status indicated on metadata (tests will supply these fields)
    if (rec.sourceStatus && rec.sourceStatus !== 'approved') continue;
    if (rec.sourceRetired) continue;
    if (rec.sourceSuperseded_by) continue;
    if (rec.chunkStatus && rec.chunkStatus !== 'approved') continue;
    if (rec.chunkDeleted) continue;
    if (rec.chunkSuperseded_by) continue;

    const vec = await vectorStore.getVector(rec.id);
    if (!Array.isArray(vec)) continue;
    if (vec.length !== qVec.length) throw new Error('vector dimension mismatch');

    const score = cosineSimilarity(qVec, vec);
    candidates.push({ rec, vec, score });
  }

  if (candidates.length === 0) return { status: 'insufficient', evidence: [], reason: 'NO_APPROVED_EVIDENCE_ABOVE_THRESHOLD' };

  // collapse duplicates by chunkId -> keep highest score
  const bestByChunk = new Map();
  for (const c of candidates) {
    const key = c.rec.chunkId || c.rec.chunk_id || c.rec.chunk || c.rec.chunkId;
    if (!key) continue;
    const prev = bestByChunk.get(key);
    if (!prev || c.score > prev.score || (c.score === prev.score && String(c.rec.id) < String(prev.rec.id))) {
      bestByChunk.set(key, c);
    }
  }

  const deduped = Array.from(bestByChunk.values());
  deduped.sort((a, b) => b.score - a.score || String(a.rec.id).localeCompare(String(b.rec.id)));

  // filter by minScore and apply topK
  const filtered = deduped.filter(x => x.score >= minScore).slice(0, topK);
  if (filtered.length === 0) return { status: 'insufficient', evidence: [], reason: 'NO_APPROVED_EVIDENCE_ABOVE_THRESHOLD' };

  const evidence = filtered.map((x, i) => ({
    citationLabel: `C${i + 1}`,
    score: Number(x.score.toFixed(6)),
    chunkId: x.rec.chunkId || x.rec.chunk_id || null,
    sourceId: x.rec.sourceId || null,
    sourceVersion: x.rec.sourceVersion || null,
    section: x.rec.section || null,
    locator: x.rec.locator || null,
    pageStart: x.rec.pageStart || null,
    pageEnd: x.rec.pageEnd || null,
    text: x.rec.text || x.rec.text_excerpt || null,
    embeddingId: x.rec.id || null
  }));

  return { status: 'sufficient', evidence };
}

module.exports = { cosineSimilarity, retrieveApprovedEvidence };

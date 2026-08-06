const { isApprovedActiveRecord } = require('./vectorRetriever');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function countTerms(tokens) {
  const map = new Map();
  for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  return map;
}

function bm25Score({ tfMap, dfMap, queryTerms, docLen, avgDocLen, totalDocs, k1 = 1.2, b = 0.75 }) {
  let score = 0;
  for (const term of queryTerms) {
    const tf = tfMap.get(term) || 0;
    if (tf === 0) continue;
    const df = dfMap.get(term) || 0;
    const idf = Math.log(1 + ((totalDocs - df + 0.5) / (df + 0.5)));
    const denom = tf + k1 * (1 - b + b * (docLen / (avgDocLen || 1)));
    score += idf * ((tf * (k1 + 1)) / denom);
  }
  return score;
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
    keywordScore: Number(score.toFixed(6))
  };
}

async function keywordRetrieve({ query, metadataStore, topK = 20, minScore = 0 }) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) throw new Error('empty query rejected');
  if (!metadataStore || typeof metadataStore.all !== 'function') throw new Error('metadataStore required');

  const allMeta = await metadataStore.all();
  const approved = allMeta.filter(isApprovedActiveRecord);
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const docs = [];
  const dfMap = new Map();

  for (const rec of approved) {
    const text = rec.text || rec.text_excerpt || '';
    const tokens = tokenize(text);
    const unique = new Set(tokens);
    for (const t of unique) dfMap.set(t, (dfMap.get(t) || 0) + 1);
    docs.push({ rec, tokens, tfMap: countTerms(tokens), docLen: tokens.length });
  }

  const totalDocs = docs.length;
  if (totalDocs === 0) return [];
  const avgDocLen = docs.reduce((s, d) => s + d.docLen, 0) / totalDocs;

  const byChunk = new Map();
  for (const d of docs) {
    const score = bm25Score({
      tfMap: d.tfMap,
      dfMap,
      queryTerms,
      docLen: d.docLen,
      avgDocLen,
      totalDocs
    });
    if (score < minScore) continue;
    const candidate = toCandidate(d.rec, score);
    if (!candidate.chunkId) continue;

    const prev = byChunk.get(candidate.chunkId);
    if (!prev || candidate.keywordScore > prev.keywordScore || (candidate.keywordScore === prev.keywordScore && String(candidate.embeddingId).localeCompare(String(prev.embeddingId)) < 0)) {
      byChunk.set(candidate.chunkId, candidate);
    }
  }

  return Array.from(byChunk.values())
    .sort((a, b) => b.keywordScore - a.keywordScore || String(a.embeddingId).localeCompare(String(b.embeddingId)))
    .slice(0, topK);
}

module.exports = {
  tokenize,
  bm25Score,
  keywordRetrieve
};

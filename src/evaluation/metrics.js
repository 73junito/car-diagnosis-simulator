const { recallAtK } = require('./recall');
const { reciprocalRank } = require('./mrr');
const { ndcgAtK } = require('./ndcg');
const { summarizeLatencyMs } = require('./latency');

function round(n, precision = 6) {
  return Number(Number(n || 0).toFixed(precision));
}

function hitsAtK(relevantChunkIds, retrievedChunkIds, k) {
  const relevant = new Set(relevantChunkIds);
  const retrieved = (retrievedChunkIds || []).slice(0, k);
  const counted = new Set();
  let hits = 0;
  for (const id of retrieved) {
    if (relevant.has(id) && !counted.has(id)) {
      counted.add(id);
      hits += 1;
    }
  }
  return hits;
}

function precisionAtK(relevantChunkIds, retrievedChunkIds, k) {
  if (!Array.isArray(relevantChunkIds) || relevantChunkIds.length === 0) throw new Error('relevantChunkIds must not be empty');
  const denom = k <= 0 ? 1 : k;
  return hitsAtK(relevantChunkIds, retrievedChunkIds, k) / denom;
}

function duplicateRateAtK(retrievedChunkIds, k) {
  const top = (retrievedChunkIds || []).slice(0, k).filter(Boolean);
  if (top.length === 0) return 0;
  const unique = new Set(top).size;
  const duplicates = top.length - unique;
  return duplicates / top.length;
}

function summarizeBenchmark(rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty benchmark rejected');

  const recallK = options.recallK || 5;
  const recallK2 = options.recallK2 || 10;
  const precisionK = options.precisionK || 5;
  const ndcgK = options.ndcgK || 10;
  const coverageK = options.coverageK || 10;

  const valid = rows.filter(r => r && !r.error);
  if (valid.length === 0) throw new Error('all benchmark rows failed');

  let recall5 = 0;
  let recall10 = 0;
  let precision5 = 0;
  let mrr = 0;
  let ndcg10 = 0;
  let coverageHits = 0;
  let duplicateRate = 0;
  const latencies = [];

  for (const row of valid) {
    const relevant = row.relevantChunkIds;
    const retrieved = row.retrievedChunkIds;
    const minRelevant = Number.isFinite(row.minimumRelevant) ? row.minimumRelevant : 1;

    const hitCoverage = hitsAtK(relevant, retrieved, coverageK);
    if (hitCoverage >= minRelevant) coverageHits += 1;

    recall5 += recallAtK(relevant, retrieved, recallK);
    recall10 += recallAtK(relevant, retrieved, recallK2);
    precision5 += precisionAtK(relevant, retrieved, precisionK);
    mrr += reciprocalRank(relevant, retrieved);
    ndcg10 += ndcgAtK(relevant, retrieved, ndcgK);
    duplicateRate += duplicateRateAtK(retrieved, coverageK);
    latencies.push(row.latencyMs || 0);
  }

  const failures = rows.filter(r => r && r.error).map(r => ({ id: r.id, error: r.error }));
  const denom = valid.length;

  return {
    queries: rows.length,
    recallAt5: round(recall5 / denom),
    recallAt10: round(recall10 / denom),
    precisionAt5: round(precision5 / denom),
    mrr: round(mrr / denom),
    ndcgAt10: round(ndcg10 / denom),
    coverage: round(coverageHits / denom),
    duplicateRate: round(duplicateRate / denom),
    latency: summarizeLatencyMs(latencies),
    failures
  };
}

module.exports = {
  hitsAtK,
  precisionAtK,
  duplicateRateAtK,
  summarizeBenchmark
};

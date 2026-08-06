const { summarizeBenchmark } = require('./metrics');
const { validateDataset } = require('./datasetLoader');

function normalizeRetrievedChunkIds(result) {
  if (Array.isArray(result)) return result.filter(Boolean);
  if (!result || typeof result !== 'object') return [];
  if (Array.isArray(result.chunkIds)) return result.chunkIds.filter(Boolean);
  if (Array.isArray(result.candidates)) {
    return result.candidates.map(c => c && c.chunkId).filter(Boolean);
  }
  return [];
}

async function runRetrievalBenchmark({ dataset, retrieve, topK = 10, metricOptions = {} }) {
  if (typeof retrieve !== 'function') throw new Error('retrieve function is required');
  const rows = validateDataset(dataset);

  const records = [];
  for (const row of rows) {
    const started = Date.now();
    try {
      const result = await retrieve(row);
      const retrievedChunkIds = normalizeRetrievedChunkIds(result).slice(0, topK);
      records.push({
        id: row.id,
        query: row.query,
        relevantChunkIds: row.relevantChunkIds,
        minimumRelevant: row.minimumRelevant || 1,
        retrievedChunkIds,
        latencyMs: Date.now() - started
      });
    } catch (err) {
      records.push({
        id: row.id,
        query: row.query,
        relevantChunkIds: row.relevantChunkIds,
        minimumRelevant: row.minimumRelevant || 1,
        retrievedChunkIds: [],
        latencyMs: Date.now() - started,
        error: err && err.message ? err.message : 'retrieval_failed'
      });
    }
  }

  const summary = summarizeBenchmark(records, metricOptions);
  return {
    summary,
    records
  };
}

module.exports = {
  normalizeRetrievedChunkIds,
  runRetrievalBenchmark
};

#!/usr/bin/env node
const path = require('path');
const { loadDatasetFromFile } = require('../src/evaluation/datasetLoader');
const { runRetrievalBenchmark } = require('../src/evaluation/benchmarkRunner');

async function main() {
  const fixturePath = path.join(__dirname, '..', 'src', 'evaluation', 'fixtures', 'retrieval-benchmark.fixture.json');
  const dataset = loadDatasetFromFile(fixturePath);

  // Deterministic offline retriever for baseline evaluation scaffolding.
  const retrieve = async (row) => ({ chunkIds: row.mockRetrievedChunkIds || [] });

  const { summary } = await runRetrievalBenchmark({
    dataset,
    retrieve,
    topK: 10,
    metricOptions: {
      recallK: 5,
      recallK2: 10,
      precisionK: 5,
      ndcgK: 10,
      coverageK: 10
    }
  });

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(1);
});

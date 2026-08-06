const { recallAtK } = require('../src/evaluation/recall');
const { reciprocalRank } = require('../src/evaluation/mrr');
const { ndcgAtK } = require('../src/evaluation/ndcg');
const { summarizeLatencyMs } = require('../src/evaluation/latency');
const { duplicateRateAtK, summarizeBenchmark } = require('../src/evaluation/metrics');
const { validateDataset } = require('../src/evaluation/datasetLoader');
const { runRetrievalBenchmark } = require('../src/evaluation/benchmarkRunner');

describe('retrieval evaluation metrics', () => {
  test('perfect Recall@K', () => {
    expect(recallAtK(['a', 'b'], ['a', 'b', 'c'], 5)).toBe(1);
  });

  test('partial recall', () => {
    expect(recallAtK(['a', 'b', 'c'], ['a', 'x', 'y'], 5)).toBeCloseTo(1 / 3);
  });

  test('zero recall', () => {
    expect(recallAtK(['a'], ['x', 'y'], 5)).toBe(0);
  });

  test('MRR rank 1, rank 2, and absent', () => {
    expect(reciprocalRank(['a'], ['a', 'x'])).toBe(1);
    expect(reciprocalRank(['a'], ['x', 'a'])).toBe(0.5);
    expect(reciprocalRank(['a'], ['x', 'y'])).toBe(0);
  });

  test('nDCG with multiple relevant chunks', () => {
    const val = ndcgAtK(['a', 'b'], ['a', 'x', 'b'], 10);
    expect(val).toBeGreaterThan(0.9);
    expect(val).toBeLessThanOrEqual(1);
  });

  test('duplicate-rate calculation', () => {
    expect(duplicateRateAtK(['a', 'a', 'b', 'c'], 10)).toBe(0.25);
    expect(duplicateRateAtK(['a', 'b', 'c'], 10)).toBe(0);
  });

  test('latency percentile calculation', () => {
    const lat = summarizeLatencyMs([5, 10, 20, 30, 40]);
    expect(lat.p50Ms).toBe(20);
    expect(lat.p95Ms).toBe(40);
    expect(lat.maxMs).toBe(40);
  });
});

describe('retrieval evaluation benchmark runner', () => {
  const dataset = [
    {
      id: 'starter-click-001',
      query: 'Starter clicks but engine does not crank',
      relevantChunkIds: ['chunk-starter-control', 'chunk-voltage-drop'],
      minimumRelevant: 1,
      tags: ['starting-system', 'no-crank']
    },
    {
      id: 'battery-drain-001',
      query: 'Battery dies overnight',
      relevantChunkIds: ['chunk-parasitic-draw-test'],
      minimumRelevant: 1
    }
  ];

  test('malformed dataset rejection', () => {
    expect(() => validateDataset([{ id: 'x', query: 'q', relevantChunkIds: [] }])).toThrow(/non-empty relevantChunkIds/);
  });

  test('empty benchmark rejection', async () => {
    await expect(runRetrievalBenchmark({ dataset: [], retrieve: async () => ({ chunkIds: [] }) })).rejects.toThrow(/empty benchmark rejected/);
  });

  test('retrieval failure recorded without crashing the whole benchmark', async () => {
    const retrieve = async (row) => {
      if (row.id === 'starter-click-001') throw new Error('backend timeout');
      return { chunkIds: ['chunk-parasitic-draw-test'] };
    };
    const result = await runRetrievalBenchmark({ dataset, retrieve, topK: 10 });
    expect(result.summary.failures.length).toBe(1);
    expect(result.summary.failures[0].id).toBe('starter-click-001');
    expect(result.summary.queries).toBe(2);
  });

  test('stable aggregate output', async () => {
    const retrieve = async (row) => {
      if (row.id === 'starter-click-001') {
        return { chunkIds: ['chunk-starter-control', 'chunk-voltage-drop', 'chunk-other'] };
      }
      return { chunkIds: ['chunk-parasitic-draw-test', 'chunk-other'] };
    };

    const { summary } = await runRetrievalBenchmark({ dataset, retrieve, topK: 10 });
    expect(summary).toEqual({
      queries: 2,
      recallAt5: 1,
      recallAt10: 1,
      precisionAt5: 0.3,
      mrr: 1,
      ndcgAt10: 1,
      coverage: 1,
      duplicateRate: 0,
      latency: summary.latency,
      failures: []
    });
    expect(summary.latency.p50Ms).toBeGreaterThanOrEqual(0);
    expect(summary.latency.p95Ms).toBeGreaterThanOrEqual(0);
  });
});

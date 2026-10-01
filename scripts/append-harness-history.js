#!/usr/bin/env node
const fs = require('fs');

const summaryPath = process.argv[2] || 'runs/run-scheduled-summary.json';
const historyPath = process.argv[3] || 'runs/history.csv';

if (!fs.existsSync(summaryPath)) {
  console.error(`Summary not found: ${summaryPath}`);
  process.exit(2);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const results = Array.isArray(summary.results) ? summary.results : [];
if (!results.length) {
  console.error('Summary contains no results.');
  process.exit(2);
}

const accepted = results.filter(result => result && result.ok).length;
const denied = results.length - accepted;
if (accepted === 0) {
  console.error('Refusing to append a history row for a zero-success harness run.');
  process.exit(1);
}

const latencies = results
  .map(result => result && result.latency)
  .filter(value => Number.isFinite(value));
const sorted = [...latencies].sort((a, b) => a - b);
const percentile = fraction => {
  if (!sorted.length) return 0;
  const index = Math.floor(fraction * (sorted.length - 1));
  return Math.round(sorted[index] || 0);
};
const average = Math.round(
  latencies.length
    ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
    : 0
);
const acceptRate = (accepted / results.length).toFixed(2);
const header = [
  'accepted',
  'denied',
  'acceptRate',
  'completed',
  'avgDuration',
  'p50',
  'p90',
  'p99',
  'notificationAttempts',
  'totalLogs',
  'generatedAt',
  'source'
].join(',');

fs.mkdirSync(require('path').dirname(historyPath), { recursive: true });
if (!fs.existsSync(historyPath)) {
  fs.writeFileSync(historyPath, header + '\n');
}

const row = [
  accepted,
  denied,
  acceptRate,
  results.length,
  average,
  percentile(0.5),
  percentile(0.9),
  percentile(0.99),
  0,
  0,
  new Date().toISOString(),
  'run-scheduled-summary.json'
].join(',');

fs.appendFileSync(historyPath, row + '\n');
console.log(`APPENDED:${row}`);

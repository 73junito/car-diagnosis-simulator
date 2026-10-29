#!/usr/bin/env node
/**
 * Appends a scheduled harness run to runs/history.csv — safely.
 *
 * The original writer appended blindly with `appendFileSync`. Because every
 * scheduled run appends to the same trailing line, a branch and `main` that each
 * add a run diverge into a line *replacement*: PR #1140 lost the 2026-10-28 record
 * and PR #1135 lost 2026-10-27 and 2026-10-28. Both were caught by
 * scripts/verify-harness-history-integrity.js, which remains the independent CI
 * safety net; this writer now refuses to create such a state in the first place.
 *
 * Guarantees:
 *  - existing records are never modified, reordered or removed (asserted before writing);
 *  - a duplicate `generatedAt` is refused, not written;
 *  - the new record is inserted at its deterministic chronological position, so a
 *    legitimate older run is backfilled instead of being rejected or misplaced;
 *  - a corrupt or out-of-order history is refused rather than extended;
 *  - the write is atomic (temp file + rename), so an interrupted run cannot truncate it.
 *
 * The row timestamp defaults to the write time. A backfill must supply the run's
 * real time, because the summary file carries only `results`/`count` — the run
 * timestamp lives in the harness export as `meta.timestamp`:
 *   node scripts/append-harness-history.js <summary.json> <history.csv> \
 *     --generated-at 2026-10-26T06:10:47.544Z
 *
 * Usage: node scripts/append-harness-history.js [summary] [history] [--generated-at <ISO>]
 * Exit codes: 0 written, 1 refused (validation), 2 usage/IO.
 */
const fs = require('fs');
const path = require('path');

const TIMESTAMP_INDEX = 10;
const FIELD_COUNT = 12;
const COLUMNS = [
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
];
const HEADER = COLUMNS.join(',');

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  let generatedAt = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--generated-at') {
      generatedAt = argv[index + 1] || null;
      if (!generatedAt) fail(2, '--generated-at requires an ISO timestamp');
      index += 1;
      continue;
    }
    positional.push(argv[index]);
  }
  return { positional, generatedAt };
}

function resolveTimestamp(value) {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(2, `--generated-at is not a valid timestamp: ${value}`);
  return new Date(parsed).toISOString();
}

/**
 * Reads the existing history. Refuses — never repairs — anything it cannot append
 * to without destroying data.
 */
function readHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return { header: HEADER, rows: [], existed: false };

  const lines = fs.readFileSync(historyPath, 'utf8').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.length) return { header: HEADER, rows: [], existed: false };

  if (lines[0].trim() !== HEADER) {
    fail(1, `Refusing to write: ${historyPath} header does not match the canonical columns.`);
  }

  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const raw = lines[index];
    if (raw.trim() === '') continue;
    const fields = raw.split(',');
    if (fields.length !== FIELD_COUNT) {
      fail(
        1,
        `Refusing to write: ${historyPath} line ${index + 1} has ${fields.length} fields, expected ${FIELD_COUNT}.`
      );
    }
    const generatedAt = fields[TIMESTAMP_INDEX].trim();
    const time = Date.parse(generatedAt);
    if (!Number.isFinite(time)) {
      fail(1, `Refusing to write: ${historyPath} line ${index + 1} has an unparseable generatedAt.`);
    }
    rows.push({ raw, generatedAt, time });
  }

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].time <= rows[index - 1].time) {
      fail(
        1,
        `Refusing to write: ${historyPath} is not strictly ascending at line ${index + 1} ` +
          `(${rows[index - 1].generatedAt} -> ${rows[index].generatedAt}).`
      );
    }
  }

  return { header: lines[0].trim(), rows, existed: true };
}

function main() {
  const { positional, generatedAt } = parseArgs(process.argv.slice(2));
  const summaryPath = positional[0] || 'runs/run-scheduled-summary.json';
  const historyPath = positional[1] || 'runs/history.csv';

  if (!fs.existsSync(summaryPath)) fail(2, `Summary not found: ${summaryPath}`);

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const results = Array.isArray(summary.results) ? summary.results : [];
  if (!results.length) fail(2, 'Summary contains no results.');

  const accepted = results.filter((result) => result && result.ok).length;
  const denied = results.length - accepted;
  if (accepted === 0) {
    fail(1, 'Refusing to append a history row for a zero-success harness run.');
  }

  const latencies = results
    .map((result) => result && result.latency)
    .filter((value) => Number.isFinite(value));
  const sorted = [...latencies].sort((a, b) => a - b);
  const percentile = (fraction) => {
    if (!sorted.length) return 0;
    const index = Math.floor(fraction * (sorted.length - 1));
    return Math.round(sorted[index] || 0);
  };
  const average = Math.round(
    latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0
  );
  const acceptRate = (accepted / results.length).toFixed(2);

  const timestamp = resolveTimestamp(generatedAt);
  const time = Date.parse(timestamp);
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
    timestamp,
    'run-scheduled-summary.json'
  ].join(',');

  const history = readHistory(historyPath);

  if (history.rows.some((existing) => existing.time === time)) {
    fail(1, `Refusing to append duplicate generatedAt ${timestamp}: already present in ${historyPath}.`);
  }

  const firstLaterRow = history.rows.findIndex((existing) => existing.time > time);
  const insertionIndex = firstLaterRow === -1 ? history.rows.length : firstLaterRow;
  const nextRows = [
    ...history.rows.slice(0, insertionIndex).map((existing) => existing.raw),
    row,
    ...history.rows.slice(insertionIndex).map((existing) => existing.raw)
  ];

  // Preservation assertion: every pre-existing record survives, byte-for-byte, in order.
  const preserved = nextRows.filter((line) => line !== row);
  if (
    preserved.length !== history.rows.length ||
    preserved.some((line, index) => line !== history.rows[index].raw)
  ) {
    fail(1, 'Refusing to write: the insertion would alter or reorder existing records.');
  }

  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  const tempPath = `${historyPath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, [history.header, ...nextRows].join('\n') + '\n');
  fs.renameSync(tempPath, historyPath);

  console.log(`APPENDED:${row}`);
  console.log(`INSERTED_AT:${insertionIndex}`);
}

main();

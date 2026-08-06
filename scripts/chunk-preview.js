#!/usr/bin/env node
// Summarize chunk files for reviewers
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: chunk-preview <chunks.json>');
  process.exit(2);
}

function findDuplicates(arr) {
  const seen = new Map();
  for (const a of arr) seen.set(a, (seen.get(a) || 0) + 1);
  return [...seen.entries()].filter(([, v]) => v > 1).map(([k]) => k);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.length < 1) usage();
  const file = argv[0];
  if (!fs.existsSync(file)) { console.error('file not found'); process.exit(3); }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const chunks = data.chunks || [];
  const tokenCounts = chunks.map(c => c.token_count || 0);
  const hashes = chunks.map(c => c.text_hash).filter(Boolean);
  const dup = findDuplicates(hashes);
  const missingLocators = chunks.filter(c => !c.locator || c.locator.trim().length === 0).length;
  const oversized = chunks.filter(c => (c.token_count || 0) > 6000).length;

  const report = {
    source: data.source || null,
    chunk_count: chunks.length,
    token_min: tokenCounts.length ? Math.min(...tokenCounts) : 0,
    token_max: tokenCounts.length ? Math.max(...tokenCounts) : 0,
    dup_hash_count: dup.length,
    missing_locators: missingLocators,
    oversized_count: oversized
  };

  console.log(JSON.stringify(report, null, 2));
}

module.exports = {};

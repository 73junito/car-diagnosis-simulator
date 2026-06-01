#!/usr/bin/env node
const fs = require('fs');

const args = process.argv.slice(2);
const path = args[0] || 'runs/run-001.json';

if (!fs.existsSync(path)) {
  console.error('Run file not found:', path);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(path));
const results = data.results || [];
const total = results.length;
const success = results.filter(r=>r && r.ok).length;
const errors = results.filter(r=>r && r.error).length;
const avgLatency = Math.round(results.filter(r=>r && r.latency).reduce((s,r)=>s+(r.latency||0),0)/Math.max(1,total));

console.log('Run:', path);
console.log(`Total: ${total}  Success: ${success}  Errors: ${errors}  AvgLatencyMs: ${avgLatency}`);

if (args.includes('--open-json')) {
  console.log(JSON.stringify(data, null, 2));
}

#!/usr/bin/env node
const fs = require('fs');

function argvMap() {
  const map = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i+1] && !args[i+1].startsWith('--') ? args[i+1] : 'true';
      map[key] = val;
      if (val !== 'true') i++;
    }
  }
  return map;
}

const args = argvMap();
const count = parseInt(args.count || '10', 10);
const mode = args.mode || 'normal';
const verify = args.verify === 'true' || args.verify === '1';
const outPath = args.export || `runs/run-${Date.now()}.json`;
const baseUrl = args.url || process.env.TARGET_URL || process.env.PREVIEW_URL;
const concurrency = parseInt(args.concurrency || args.concur || '5', 10);
const rate = args.rate ? parseFloat(args.rate) : null; // requests per second

if (!baseUrl) {
  console.error('Error: target URL not specified. Use --url or set TARGET_URL/PREVIEW_URL env.');
  process.exit(2);
}

async function sendRequest(i) {
  const start = Date.now();
  const payload = {
    name: `tester-${i}`,
    email: `tester+${i}@example.com`,
    scenario: `scenario-${i % 5}`,
    notes: `run ${Date.now()}`,
  };

  let url = `${baseUrl.replace(/\/$/, '')}/api/request-pilot`;
  let options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  // Optionally set harness bypass header when env or arg present
  const harnessBypass = process.env.X_HARNESS_BYPASS === 'true' || process.env.X_HARNESS_BYPASS === '1' || args['harness-bypass'] === 'true' || args['harness-bypass'] === '1';
  if(harnessBypass){ options.headers['X-HARNESS-BYPASS'] = 'true'; }

  // mixed-failure: occasionally send invalid JSON or wrong path
  if (mode === 'mixed-failure' && Math.random() < 0.15) {
    options.body = '{ invalid json';
  }

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const latency = Date.now() - start;
    let ok = res.ok;
    let body;
    try { body = JSON.parse(text); } catch (e) { body = text; }
    return { index: i, status: res.status, ok, latency, body };
  } catch (err) {
    return { index: i, error: String(err), latency: Date.now() - start };
  }
}

async function run() {
  const results = [];
  for (let i = 0; i < count; ) {
    const batch = [];
    for (let j = 0; j < concurrency && i < count; j++, i++) batch.push(sendRequest(i));
    const res = await Promise.all(batch);
    results.push(...res);
    process.stdout.write(`Progress: ${results.length}/${count}\r`);
    // rate limiting between batches: if rate provided, pause to keep approx requests/sec
    if (rate && batch.length > 0) {
      const delayMs = Math.max(0, Math.round((1000 * batch.length) / rate));
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ meta: { baseUrl, count, mode, verify, timestamp: Date.now() }, results }, null, 2));
  console.log(`\nWrote results to ${outPath}`);
  // basic summary
  const succ = results.filter(r => r && r.ok).length;
  const fail = results.length - succ;
  const avg = Math.round(results.filter(r=>r && r.latency).reduce((s, r)=>s + r.latency,0)/results.length||0);
  console.log(`Summary: total=${results.length} success=${succ} fail=${fail} avgLatencyMs=${avg}`);
}

run().catch(e=>{ console.error(e); process.exit(1); });

#!/usr/bin/env node
const fs = require('fs');

function argvMap() {
  const map = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
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
let baseUrl = args.url || process.env.TARGET_URL || process.env.PREVIEW_URL;
if (baseUrl && typeof baseUrl === 'string') baseUrl = baseUrl.trim();

const requestPath = args.path || '/api/curriculum';
const requestMethod = String(args.method || 'GET').trim().toUpperCase();
const minSuccessRate = args['min-success-rate'] == null
  ? null
  : Number(args['min-success-rate']);
const concurrency = parseInt(args.concurrency || args.concur || '5', 10);
const rate = args.rate ? parseFloat(args.rate) : null;

if (!baseUrl) {
  console.error('Error: target URL not specified. Use --url or set TARGET_URL/PREVIEW_URL env.');
  process.exit(2);
}
if (!/^https?:\/\//i.test(baseUrl)) {
  console.error('Error: target URL must include protocol (http:// or https://).');
  process.exit(2);
}
if (!requestPath.startsWith('/')) {
  console.error('Error: --path must begin with /.');
  process.exit(2);
}
if (minSuccessRate != null && (!Number.isFinite(minSuccessRate) || minSuccessRate < 0 || minSuccessRate > 1)) {
  console.error('Error: --min-success-rate must be between 0 and 1.');
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

  const url = `${baseUrl.replace(/\/$/, '')}${requestPath}`;
  const headers = {};
  const options = { method: requestMethod, headers };

  if (!['GET', 'HEAD'].includes(requestMethod)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }

  const harnessBypass =
    process.env.X_HARNESS_BYPASS === 'true' ||
    process.env.X_HARNESS_BYPASS === '1' ||
    args['harness-bypass'] === 'true' ||
    args['harness-bypass'] === '1';
  if (harnessBypass) headers['X-HARNESS-BYPASS'] = 'true';

  if (mode === 'mixed-failure' && options.body && Math.random() < 0.15) {
    options.body = '{ invalid json';
  }

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const latency = Date.now() - start;
    let body;
    try { body = JSON.parse(text); } catch (e) { body = text; }
    return { index: i, status: res.status, ok: res.ok, latency, body };
  } catch (err) {
    return { index: i, error: String(err), ok: false, latency: Date.now() - start };
  }
}

async function run() {
  const results = [];
  for (let i = 0; i < count;) {
    const batch = [];
    for (let j = 0; j < concurrency && i < count; j++, i++) batch.push(sendRequest(i));
    results.push(...await Promise.all(batch));
    process.stdout.write(`Progress: ${results.length}/${count}\r`);

    if (rate && batch.length > 0) {
      const delayMs = Math.max(0, Math.round((1000 * batch.length) / rate));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const succ = results.filter(result => result && result.ok).length;
  const fail = results.length - succ;
  const latencies = results
    .map(result => result && result.latency)
    .filter(value => Number.isFinite(value));
  const avg = Math.round(
    latencies.length
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : 0
  );
  const successRate = results.length ? succ / results.length : 0;

  fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    meta: {
      baseUrl,
      path: requestPath,
      method: requestMethod,
      count,
      mode,
      verify,
      minSuccessRate,
      timestamp: Date.now()
    },
    results
  }, null, 2));

  console.log(`\nWrote results to ${outPath}`);
  console.log(
    `Summary: total=${results.length} success=${succ} fail=${fail} successRate=${successRate.toFixed(2)} avgLatencyMs=${avg}`
  );

  if (minSuccessRate != null && successRate < minSuccessRate) {
    console.error(
      `Harness gate failed: successRate=${successRate.toFixed(2)} required=${minSuccessRate.toFixed(2)}`
    );
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});

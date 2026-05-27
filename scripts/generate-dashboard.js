const fs = require('fs');
const path = require('path');

function loadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function renderTable(rows, headers) {
  let html = '<table class="table">\n<thead><tr>' + headers.map(h=>`<th>${h}</th>`).join('') + '</tr></thead>\n<tbody>\n';
  for (const r of rows) {
    html += '<tr>' + headers.map(h => `<td>${r[h] ?? ''}</td>`).join('') + '</tr>\n';
  }
  html += '</tbody></table>\n';
  return html;
}

function build() {
  const outDir = path.resolve(process.cwd(), 'test-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const flaky = loadJSON(path.join(outDir, 'flaky-history.json')) || { tests: {}, runs: [] };
  const slow = loadJSON(path.join(outDir, 'slow-tests.json')) || { slow: [] };

  // Generate top flaky tests table
  const flakyEntries = Object.entries(flaky.tests || {}).map(([name, data]) => ({ Name: name, Flakes: data.flakeCount || 0, Runs: data.totalRuns || 0, Last: data.lastFailureAt || '' }));
  flakyEntries.sort((a,b)=>b.Flakes - a.Flakes);

  // Slow tests list
  const slowEntries = (slow.slow || []).map(s => ({ Name: `${s.classname} — ${s.name}`, TimeMs: s.timeMs }));

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Health Dashboard</title>
  <style>
    body{font-family:system-ui,Segoe UI,Arial;margin:20px}
    .table{border-collapse:collapse;width:100%}
    .table th,.table td{border:1px solid #ddd;padding:6px}
    h2{margin-top:24px}
  </style>
</head>
<body>
  <h1>Test Health Dashboard</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <h2>Top flaky tests</h2>
  ${renderTable(flakyEntries.slice(0,50), ['Name','Flakes','Runs','Last'])}
  <h2>Slow tests (above threshold)</h2>
  ${renderTable(slowEntries.slice(0,50), ['Name','TimeMs'])}
  <h2>Recent runs</h2>
  <ul>
    ${(flaky.runs || []).slice(-10).reverse().map(r=>`<li>${r.timestamp} — failures: ${r.failures.length}</li>`).join('\n')}
  </ul>
</body>
</html>`;

  const outPath = path.join(outDir, 'dashboard.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('Wrote dashboard to', outPath);
}

build();

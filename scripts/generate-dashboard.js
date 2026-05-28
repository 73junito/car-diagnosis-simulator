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

  // Prepare chart data
  const runs = flaky.runs || [];
  const recentRuns = runs.slice(-50);
  const runLabels = recentRuns.map(r => new Date(r.timestamp).toLocaleString());
  const runFailures = recentRuns.map(r => (r.failures || []).length);

  const topFlaky = flakyEntries.slice(0, 20);
  const topFlakyLabels = topFlaky.map(t => t.Name);
  const topFlakyCounts = topFlaky.map(t => t.Flakes);

  // Build sparkline data: for each top flaky test, map recent runs to 1/0 based on failure presence
  const sparkData = topFlaky.map(entry => {
    const testName = entry.Name;
    return recentRuns.map(r => (r.failures || []).includes(testName) ? 1 : 0);
  });

  const topSlow = slowEntries.slice(0, 20);
  const topSlowLabels = topSlow.map(s => s.Name);
  const topSlowTimes = topSlow.map(s => s.TimeMs);

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
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .card{background:#fff;border:1px solid #eee;padding:12px;border-radius:6px}
    canvas{max-width:100%;height:300px}
    @media(max-width:800px){.grid{grid-template-columns:1fr}}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>Test Health Dashboard</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <div class="grid">
    <div class="card">
      <h2>Failures Over Time</h2>
      <canvas id="failuresOverTime"></canvas>
    </div>
    <div class="card">
      <h2>Top Flaky Tests</h2>
      <canvas id="topFlaky"></canvas>
    </div>
  </div>

  <div class="card" style="margin-top:20px">
    <h2>Slow Tests (top)</h2>
    <canvas id="slowTests"></canvas>
  </div>

  <h2>Top flaky tests (table)</h2>
  <table class="table">
    <thead><tr><th>Test</th><th>Flakes</th><th>Runs</th><th>Last</th><th>Trend</th></tr></thead>
    <tbody>
      ${topFlaky.slice(0,50).map((t,i)=>`<tr><td>${t.Name}</td><td>${t.Flakes}</td><td>${t.Runs}</td><td>${t.Last}</td><td><canvas id="spark-${i}" width="160" height="40"></canvas></td></tr>`).join('\n')}
    </tbody>
  </table>

  <h2>Slow tests (table)</h2>
  ${renderTable(slowEntries.slice(0,50), ['Name','TimeMs'])}

  <h2>Recent runs</h2>
  <ul>
    ${(flaky.runs || []).slice(-10).reverse().map(r=>`<li>${r.timestamp} — failures: ${r.failures.length}</li>`).join('\n')}
  </ul>

  <script>
    const runLabels = ${JSON.stringify(runLabels)};
    const runFailures = ${JSON.stringify(runFailures)};
    const topFlakyLabels = ${JSON.stringify(topFlakyLabels)};
    const topFlakyCounts = ${JSON.stringify(topFlakyCounts)};
    const topSlowLabels = ${JSON.stringify(topSlowLabels)};
    const topSlowTimes = ${JSON.stringify(topSlowTimes)};

    function makeLine(ctx, labels, data, label){
      return new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label, data, borderColor: 'rgb(220,53,69)', backgroundColor: 'rgba(220,53,69,0.1)', tension:0.2 }] },
        options: { responsive:true, plugins:{legend:{display:false}} }
      });
    }

    function makeBar(ctx, labels, data, label, color='rgb(0,123,255)'){
      return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label, data, backgroundColor: color }] },
        options: { responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{autoSkip:true,maxRotation:45,minRotation:0}}} }
      });
    }

    document.addEventListener('DOMContentLoaded', ()=>{
      const fctx = document.getElementById('failuresOverTime').getContext('2d');
      makeLine(fctx, runLabels, runFailures, 'Failures');

      const tctx = document.getElementById('topFlaky').getContext('2d');
      makeBar(tctx, topFlakyLabels, topFlakyCounts, 'Flake Count', 'rgb(255,159,64)');

      const sctx = document.getElementById('slowTests').getContext('2d');
      makeBar(sctx, topSlowLabels, topSlowTimes, 'Time (ms)', 'rgb(40,167,69)');

      // Render sparklines for each top flaky test
      try {
        const sparkData = ${JSON.stringify(sparkData)};
        sparkData.forEach((series, idx) => {
          const el = document.getElementById(`spark-${idx}`);
          if (!el) return;
          new Chart(el.getContext('2d'), {
            type: 'bar',
            data: { labels: runLabels, datasets: [{ data: series, backgroundColor: series.map(v=>v? 'rgb(220,53,69)':'rgba(200,200,200,0.15)') }] },
            options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{display:false}, y:{display:false}} }
          });
        });
      } catch (e){ console.error('sparkline render failed', e); }
    });
  </script>

</body>
</html>`;

  const outPath = path.join(outDir, 'dashboard.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('Wrote dashboard to', outPath);
}

build();

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const fetch = global.fetch || require('node-fetch');

async function listArtifacts(owner, repo, token) {
  const api = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
  const res = await fetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`Failed to list artifacts: ${res.status}`);
  const j = await res.json();
  return j.artifacts || [];
}

async function downloadArtifactJson(owner, repo, token, artifactId, entrySuffix) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;
  const dl = await fetch(url, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!dl.ok) return null;
  const buffer = Buffer.from(await dl.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entry = zip.getEntries().find(e => e.entryName.endsWith(entrySuffix));
  if (!entry) return null;
  const content = entry.getData().toString('utf8');
  try { return JSON.parse(content); } catch (e) { return null; }
}

function median(values) {
  if (!values.length) return null;
  const s = values.slice().sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length%2 ? s[mid] : (s[mid-1]+s[mid])/2;
}

async function run() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const prNumber = process.env.PR_NUMBER;
  const ownerRepo = repo ? repo.split('/') : null;
  if (!repo || !token || !prNumber || !ownerRepo) {
    console.log('Missing required env (GITHUB_REPOSITORY, GITHUB_TOKEN, PR_NUMBER) — skipping slow-trend alerts.');
    return;
  }
  const [owner, repoName] = ownerRepo;

  const outPath = path.resolve(process.cwd(), 'test-results', 'slow-tests.json');
  if (!fs.existsSync(outPath)) {
    console.log('No current slow-tests.json found — skipping.');
    return;
  }
  const current = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const currentSlow = current.slow || [];

  // parameters
  const lookback = Number(process.env.SLOW_TREND_LOOKBACK || 8);
  const minHistory = Number(process.env.SLOW_TREND_MIN_HISTORY || 3);
  const percent = Number(process.env.SLOW_TREND_PERCENT || 0.25); // 25% slower
  const minDeltaMs = Number(process.env.SLOW_TREND_MIN_DELTA_MS || 200);

  // fetch artifacts named 'slow-tests'
  let artifacts = await listArtifacts(owner, repoName, token).catch(()=>[]);
  artifacts = artifacts.filter(a => a.name === 'slow-tests').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const recent = artifacts.slice(0, lookback);

  const history = [];
  for (const a of recent) {
    const j = await downloadArtifactJson(owner, repoName, token, a.id, 'slow-tests.json').catch(()=>null);
    if (j && j.slow) history.push({ created_at: a.created_at, slow: j.slow });
  }

  // build per-test history of times
  const perTest = {}; // name -> [times]
  for (const run of history.reverse()) { // oldest -> newest
    for (const s of run.slow) {
      const name = `${s.classname} — ${s.name}`;
      perTest[name] = perTest[name] || [];
      perTest[name].push(s.timeMs);
    }
  }

  const regressions = [];
  for (const s of currentSlow) {
    const name = `${s.classname} — ${s.name}`;
    const times = perTest[name] || [];
    if (times.length < minHistory) continue;
    const base = median(times);
    if (base == null) continue;
    const cur = s.timeMs;
    const pct = (cur - base) / base;
    if (cur - base >= minDeltaMs && pct >= percent) {
      regressions.push({ name, baseline: Math.round(base), current: cur, pct: Math.round(pct*100) });
    }
  }

  if (!regressions.length) {
    console.log('No slow-test regressions detected.');
    return;
  }

  const dashboardUrl = `https://${owner}.github.io/${repoName}/dashboard.html`;
  let body = `<!-- slow-trend -->\n`;
  body += `\n**Live dashboard:** [Open test dashboard](${dashboardUrl})\n\n`;
  body += `**Slow test regressions detected:**\n`;
  for (const r of regressions) {
    body += `- ${r.name} — baseline ${r.baseline}ms → ${r.current}ms (+${r.pct}%)\n`;
  }

  // post or update PR comment
  const apiBase = 'https://api.github.com';
  const listUrl = `${apiBase}/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
  const headers = { Authorization: `token ${token}`, 'User-Agent': 'slow-test-trend' };
  const res = await fetch(listUrl, { headers });
  const comments = await res.json();
  const existing = comments.find(c => c.body && c.body.includes('<!-- slow-trend -->'));
  if (existing) {
    const patchUrl = `${apiBase}/repos/${owner}/${repoName}/issues/comments/${existing.id}`;
    await fetch(patchUrl, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    console.log('Updated existing slow-trend comment.');
  } else {
    const postUrl = `${apiBase}/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
    await fetch(postUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    console.log('Posted new slow-trend comment.');
  }
}

run().catch(err=>{ console.error(err); process.exit(1); });

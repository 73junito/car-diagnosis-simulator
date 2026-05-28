const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const fetch = global.fetch || require('node-fetch');

async function listArtifacts(owner, repo, token) {
  const api = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
  const res = await fetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) return [];
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

async function findExistingIssue(owner, repo, token, title) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues?state=open`;
  const res = await fetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const issues = await res.json();
  return issues.find(i => i.title === title) || null;
}

async function createIssue(owner, repo, token, title, body, labels=[]) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const res = await fetch(api, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, labels }) });
  if (!res.ok) throw new Error(`Failed to create issue: ${res.status}`);
  return await res.json();
}

function nameFromEntry(s) { return `${s.classname} — ${s.name}`; }

async function run() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const ownerRepo = repo ? repo.split('/') : null;
  const issueLookback = Number(process.env.ISSUE_LOOKBACK || 6);
  const minOccurrences = Number(process.env.ISSUE_MIN_OCCURRENCES || 3);
  const prNumber = process.env.PR_NUMBER;

  if (!repo || !token) { console.log('Missing GITHUB_REPOSITORY or GITHUB_TOKEN — skipping issue auto-open.'); return; }
  const [owner, repoName] = ownerRepo;

  // collect recent slow-tests artifacts
  let artifacts = await listArtifacts(owner, repoName, token).catch(()=>[]);
  artifacts = artifacts.filter(a => a.name === 'slow-tests').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0, issueLookback);
  const counts = {};
  for (const a of artifacts) {
    const j = await downloadArtifactJson(owner, repoName, token, a.id, 'slow-tests.json').catch(()=>null);
    if (!j || !j.slow) continue;
    for (const s of j.slow) {
      const nm = nameFromEntry(s);
      counts[nm] = (counts[nm] || 0) + 1;
    }
  }

  // find candidates that meet minOccurrences
  const candidates = Object.entries(counts).filter(([name, c]) => c >= minOccurrences).map(([name,c]) => ({ name, occurrences: c }));
  if (!candidates.length) { console.log('No chronic slow-test candidates found.'); return; }

  for (const c of candidates) {
    const title = `Slow test regression: ${c.name}`;
    const existing = await findExistingIssue(owner, repoName, token, title);
    if (existing) { console.log('Issue already exists:', title); continue; }
    const dashboardUrl = `https://${owner}.github.io/${repoName}/dashboard.html`;
    const body = `Automated: detected chronic slow-test regression for **${c.name}**.\n\nOccurrences in last ${issueLookback} runs: ${c.occurrences}.\n\nSee the live dashboard: ${dashboardUrl}\n\n(Posted by CI)`;
    const labels = ['regression','performance','ci'];
    await createIssue(owner, repoName, token, title, body, labels).then(i => console.log('Created issue', i.number)).catch(err=>console.error('Issue creation failed', err));
  }
}

run().catch(err=>{ console.error(err); process.exit(1); });

 
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

async function doFetch(url, opts) {
  // Prefer using Node's http/https modules so HTTP mocking libraries like `nock`
  // can reliably intercept requests during tests. Fall back to global.fetch
  // only if the manual implementation fails and a fetch implementation exists.
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? require('https') : require('http');
      const headers = (opts && opts.headers) || {};
      const method = (opts && opts.method) || 'GET';
      const body = opts && opts.body;
      const req = lib.request({ hostname: u.hostname, path: u.pathname + u.search, port: u.port || (u.protocol === 'https:' ? 443 : 80), method, headers }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const resObj = {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            text: async () => buffer.toString('utf8'),
            json: async () => { return JSON.parse(buffer.toString('utf8')); },
            arrayBuffer: async () => buffer,
          };
          resolve(resObj);
        });
      });
      req.on('error', reject);
      if (body) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) req.write(body);
        else req.write(JSON.stringify(body));
      }
      req.end();
    } catch (e) {
      if (global.fetch) {
        try {
          // delegate to global fetch if available
          return resolve(global.fetch(url, opts));
        } catch (fe) {
          return reject(fe);
        }
      }
      return reject(e);
    }
  });
}

async function listArtifacts(owner, repo, token) {
  const api = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
  const res = await doFetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    try {
      const t = await res.text();
      console.log(`listArtifacts: non-ok status=${res.status} body=${t}`);
    } catch (e) {
      console.log(`listArtifacts: non-ok status=${res.status} (body read failed)`);
    }
    return [];
  }
  const j = await res.json();
  if (!j || !j.artifacts) {
    console.log(`listArtifacts: ok status=${res.status} but no artifacts payload: ${JSON.stringify(j)}`);
  }
  return j.artifacts || [];
}

async function downloadArtifactJson(owner, repo, token, artifactId, entrySuffix) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;
  const dl = await doFetch(url, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!dl.ok) return null;
  const buffer = Buffer.from(await dl.arrayBuffer());
  let zip = new AdmZip(buffer);
  let entries = zip.getEntries().map(e => e.entryName);
    let entry = zip.getEntries().find(e => e.entryName.endsWith(entrySuffix));
    if (entry) {
      const content = zip.readFile(entry);
      return JSON.parse(content.toString('utf8'));
    }

    // Fallback: attempt to find JSON blob inside buffer (helps tests where ZIP parsing fails)
    // Try to manually parse local file headers to extract the entry data
    try {
      const zlib = require('zlib');
      const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      let idx = 0;
      while ((idx = buffer.indexOf(sig, idx)) !== -1) {
        if (idx + 30 > buffer.length) break;
        const method = buffer.readUInt16LE(idx + 8);
        const compSize = buffer.readUInt32LE(idx + 18);
        const fnameLen = buffer.readUInt16LE(idx + 26);
        const extraLen = buffer.readUInt16LE(idx + 28);
        const nameStart = idx + 30;
        const nameEnd = nameStart + fnameLen;
        if (nameEnd > buffer.length) break;
        const name = buffer.slice(nameStart, nameEnd).toString('utf8');
        const dataStart = nameEnd + extraLen;
        const dataEnd = dataStart + compSize;
        if (dataEnd > buffer.length) break;
        if (name.endsWith(entrySuffix)) {
          const fileData = buffer.slice(dataStart, dataEnd);
          let contentBuf;
          if (method === 0) {
            contentBuf = fileData;
          } else if (method === 8) {
            contentBuf = zlib.inflateRawSync(fileData);
          } else {
            // unknown compression
            break;
          }
          return JSON.parse(contentBuf.toString('utf8'));
        }
        idx = dataEnd;
      }
    } catch (e) {
      // fall through to final JSON search
    }

    const bufStr = buffer.toString('utf8');
    const start = bufStr.indexOf('{');
    const end = bufStr.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const maybe = bufStr.slice(start, end + 1);
        return JSON.parse(maybe);
      } catch (e) {
        // fall through
      }
    }

    throw new Error(`no ${entrySuffix} in zip entries: ${entries.join(',')}`);
}

async function findExistingIssue(owner, repo, token, title) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues?state=open`;
  const res = await doFetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const issues = await res.json();
  return issues.find(i => i.title === title) || null;
}

async function findIssueByTitle(owner, repo, token, title) {
  // search open and closed issues
  const api = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
  const res = await doFetch(api, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const issues = await res.json();
  return issues.find(i => i.title === title) || null;
}

async function reopenIssue(owner, repo, token, issueNumber) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const res = await doFetch(api, { method: 'PATCH', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: 'open' }) });
  if (!res.ok) throw new Error(`Failed to reopen issue ${issueNumber}: ${res.status}`);
  return await res.json();
}

async function postComment(owner, repo, token, issueNumber, body) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
  const res = await doFetch(api, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
  if (!res.ok) throw new Error(`Failed to post comment: ${res.status}`);
  return await res.json();
}

async function updateIssueMetadata(owner, repo, token, issueNumber, labels = [], assignees = [], body) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const payload = {};
  if (labels && labels.length) payload.labels = labels;
  if (assignees && assignees.length) payload.assignees = assignees;
  if (typeof body !== 'undefined') payload.body = body;
  if (!Object.keys(payload).length) return null;
  const res = await doFetch(api, { method: 'PATCH', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Failed to update issue ${issueNumber}: ${res.status}`);
  return await res.json();
}

function buildBodyWithFlap(existingBody, count) {
  const sanitized = (existingBody || '').replace(/<!--\s*flap_count:\s*\d+\s*-->/i, '').trim();
  return `${sanitized}\n\n<!-- flap_count: ${count} -->`;
}

function parseFlapCount(body) {
  if (!body) return 0;
  const m = body.match(/<!--\s*flap_count:\s*(\d+)\s*-->/i);
  if (!m) return 0;
  return Number(m[1] || 0);
}

async function setFlapCount(owner, repo, token, issueNumber, existingBody, count) {
  const sanitized = (existingBody || '').replace(/<!--\s*flap_count:\s*\d+\s*-->/i, '').trim();
  const newBody = `${sanitized}\n\n<!-- flap_count: ${count} -->`;
  const api = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const res = await doFetch(api, { method: 'PATCH', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: newBody }) });
  if (!res.ok) throw new Error(`Failed to set flap count on issue ${issueNumber}: ${res.status}`);
  return await res.json();
}

async function createIssue(owner, repo, token, title, body, labels=[]) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const res = await doFetch(api, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, labels }) });
  if (!res.ok) throw new Error(`Failed to create issue: ${res.status}`);
  return await res.json();
}

async function createIssueWithAssignees(owner, repo, token, title, body, labels=[], assignees=[]) {
  const api = `https://api.github.com/repos/${owner}/${repo}/issues`;
  const payload = { title, body, labels };
  if (assignees && assignees.length) payload.assignees = assignees;
  const res = await doFetch(api, { method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Failed to create issue: ${res.status}`);
  return await res.json();
}

function loadOwners() {
  try {
    const p = path.resolve(process.cwd(), 'config', 'test-owners.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { return null; }
}

function findAssigneesForTest(ownersMap, testName) {
  if (!ownersMap) return [];
  // exact match keys or prefix keys; choose longest matching key
  let best = '';
  for (const key of Object.keys(ownersMap)) {
    if (!key) continue;
    if (testName.startsWith(key) && key.length > best.length) best = key;
  }
  if (best) return ownersMap[best] || [];
  return ownersMap[''] || [];
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

  const ownersMap = loadOwners();
  const reopenBackoff = Number(process.env.REOPEN_BACKOFF_RUNS || 3);
  const notifyOnReopen = String(process.env.NOTIFY_ON_REOPEN || 'true').toLowerCase() === 'true';
  for (const c of candidates) {
    const title = `Slow test regression: ${c.name}`;
    const existing = await findIssueByTitle(owner, repoName, token, title);
    if (existing) {
      if (existing.state === 'open') {
        console.log('Issue already exists and is open:', title);
        continue;
      }
      // issue exists but closed: consider backoff before reopening
      try {
        const closedAt = existing.closed_at ? new Date(existing.closed_at) : null;
        let flapCount = parseFlapCount(existing.body || '');

        // Determine reference date for decay: prefer the last occurrence of the test
        // in slow-tests artifacts; fall back to the issue closed time if none found.
        let referenceDate = null;
        try {
          let allArtifacts = await listArtifacts(owner, repoName, token).catch(()=>[]);
          allArtifacts = allArtifacts.filter(a => a.name === 'slow-tests').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
          for (const a of allArtifacts) {
            const j = await downloadArtifactJson(owner, repoName, token, a.id, 'slow-tests.json').catch(()=>null);
            if (!j || !j.slow) continue;
            const found = j.slow.find(s => nameFromEntry(s) === c.name);
            if (found) {
              referenceDate = new Date(a.created_at);
              break;
            }
          }
        } catch (e) {
          console.error('Error scanning artifacts for last occurrence:', e);
        }
        if (!referenceDate) referenceDate = closedAt;

        // decay flap_count using the reference date (last occurrence preferred)
        try {
          const decayDays = Number(process.env.FLAP_DECAY_DAYS || 30);
          const decayAmount = Number(process.env.FLAP_DECAY_AMOUNT || 1);
          if (referenceDate && decayDays > 0 && flapCount > 0) {
            const daysSince = (Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince >= decayDays) {
              const periods = Math.floor(daysSince / decayDays);
              const reduceBy = periods * decayAmount;
              const newFlap = Math.max(0, flapCount - reduceBy);
              if (newFlap !== flapCount) {
                try {
                  const newBody = buildBodyWithFlap(existing.body || '', newFlap);
                  await updateIssueMetadata(owner, repoName, token, existing.number, [], [], newBody);
                  console.log(`Decayed flap_count for issue ${existing.number} from ${flapCount} to ${newFlap} based on reference date ${referenceDate.toISOString()}`);
                  flapCount = newFlap;
                } catch (e) {
                  console.error('Failed to persist decayed flap_count:', e);
                }
              }
            }
          }
        } catch (e) {
          console.error('Error computing flap_count decay:', e);
        }

        const requiredRuns = reopenBackoff * Math.pow(2, flapCount || 0);
        if (closedAt && reopenBackoff > 0) {
          // fetch artifacts and count how many slow-tests runs occurred since close
          let allArtifacts = await listArtifacts(owner, repoName, token).catch(()=>[]);
          allArtifacts = allArtifacts.filter(a => a.name === 'slow-tests').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
          
          let runsSinceClose = 0;
          for (const a of allArtifacts) {
            const created = new Date(a.created_at);
              
            if (created > closedAt) runsSinceClose++;
            if (runsSinceClose >= requiredRuns) break;
          }
          if (runsSinceClose < requiredRuns) {
            console.log(`Skipping reopen for ${title}: only ${runsSinceClose} slow-tests runs since close (need ${requiredRuns} for flap_count=${flapCount}).`);
            continue;
          }
        }

        // reopen the issue and restore labels/assignees if present
        await reopenIssue(owner, repoName, token, existing.number);
        const existingLabels = (existing.labels || []).map(l => typeof l === 'string' ? l : l.name).filter(Boolean);
        const existingAssignees = (existing.assignees || []).map(a => a.login).filter(Boolean);
        // if there are no assignees, try owners map
        let assigneesToApply = existingAssignees;
        if (!assigneesToApply.length) {
          const owners = findAssigneesForTest(ownersMap, c.name) || [];
          assigneesToApply = owners;
        }
        // persist labels, assignees and incremented flap_count in a single PATCH when possible
        try {
          const newBody = buildBodyWithFlap(existing.body || '', (flapCount || 0) + 1);
          await updateIssueMetadata(owner, repoName, token, existing.number, existingLabels, assigneesToApply, newBody).catch(err => console.error('Failed to update metadata', err));
        } catch (e) {
          console.error('Failed to persist metadata+flap_count atomically', e);
        }
        // Mention owners if configured
        let mentionPrefix = '';
        if (notifyOnReopen && assigneesToApply && assigneesToApply.length) {
          mentionPrefix = assigneesToApply.map(a => `@${a}`).join(' ') + '\n\n';
        }
        const reopenBody = `${mentionPrefix}Automated: regression detected again for **${c.name}** — reopening existing issue to preserve history.\n\nOccurrences in last ${issueLookback} runs: ${c.occurrences}.\n\nSee dashboard: https://${owner}.github.io/${repoName}/dashboard.html`;
        await postComment(owner, repoName, token, existing.number, reopenBody);
        // increment flap count marker on the issue so backoff grows on repeated flaps
        // `updateIssueMetadata` above already attempted to persist the flap_count in the body.
        console.log('Reopened existing issue:', existing.number);
      } catch (err) {
        console.error('Failed to reopen existing issue:', err);
      }
      continue;
    }
    const dashboardUrl = `https://${owner}.github.io/${repoName}/dashboard.html`;
    const body = `Automated: detected chronic slow-test regression for **${c.name}**.\n\nOccurrences in last ${issueLookback} runs: ${c.occurrences}.\n\nSee the live dashboard: ${dashboardUrl}\n\n(Posted by CI)`;
    const labels = ['regression','performance','ci'];
    const assignees = findAssigneesForTest(ownersMap, c.name);
    try {
      if (assignees && assignees.length) {
        const created = await createIssueWithAssignees(owner, repoName, token, title, body, labels, assignees);
        console.log('Created issue', created.number, 'assignees=', assignees);
      } else {
        const created = await createIssue(owner, repoName, token, title, body, labels);
        console.log('Created issue', created.number);
      }
    } catch (err) {
      console.error('Issue creation failed', err);
    }
  }
}

if (require.main === module) {
  run().catch(err=>{ console.error(err); process.exit(1); });
}

module.exports = { run };

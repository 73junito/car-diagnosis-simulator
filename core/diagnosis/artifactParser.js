const isBuffer = (v) => Buffer && Buffer.isBuffer && Buffer.isBuffer(v);

function tryParseJsonString(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function extractJsonFromBuffer(buf) {
  // try raw JSON
  const asString = buf.toString('utf8');
  const parsed = tryParseJsonString(asString);
  if (parsed) return parsed;

  // try ZIP
  // attempt to read as ZIP if JSON parse failed
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    for (const e of entries) {
      if (e.entryName && e.entryName.toLowerCase().endsWith('.json')) {
        const txt = e.getData().toString('utf8');
        const p = tryParseJsonString(txt);
        if (p) return p;
      }
    }
  } catch (err) {
    // not a zip or failed to parse; fall through
  }
  // fallback: try to locate a JSON substring inside the buffer
  try {
    const s = buf.toString('utf8');
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const sub = s.slice(first, last + 1);
      const p = tryParseJsonString(sub);
      if (p) return p;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function normalizeTestEntry(t) {
  return {
    name: t.name || t.fullName || t.title || 'unknown',
    status: (t.status || t.outcome || 'unknown').toString(),
    duration: Number.isFinite(t.duration) ? t.duration : (t.time || t.ms || 0),
    suite: t.suite || t.parent || t.file || null
  };
}

async function parseArtifact(input, opts = {}) {
  let obj = null;
  if (isBuffer(input)) {
    obj = extractJsonFromBuffer(input);
  } else if (typeof input === 'string') {
    obj = tryParseJsonString(input);
  } else if (typeof input === 'object' && input !== null) {
    obj = input;
  }

  const tests = [];
  if (obj) {
    if (Array.isArray(obj.tests)) {
      for (const t of obj.tests) tests.push(normalizeTestEntry(t));
    } else if (Array.isArray(obj.testResults)) {
      for (const suite of obj.testResults) {
        if (Array.isArray(suite.tests)) {
          for (const t of suite.tests) tests.push(normalizeTestEntry(t));
        }
      }
    } else if (Array.isArray(obj.results)) {
      for (const t of obj.results) tests.push(normalizeTestEntry(t));
    }
  }

  const metadata = {
    runId: opts.runId || (obj && obj.runId) || null,
    repo: opts.repo || (obj && obj.repo) || null,
    timestamp: opts.timestamp || (obj && obj.timestamp) || Date.now()
  };

  return { tests, metadata };
}

module.exports = { parseArtifact };

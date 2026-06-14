let _fetch = null;
function getFetch() {
  if (_fetch) return _fetch;
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    _fetch = globalThis.fetch.bind(globalThis);
    return _fetch;
  }
  try {
    const undici = require('undici');
    if (undici && undici.fetch) {
      _fetch = undici.fetch.bind(undici);
      return _fetch;
    }
  } catch (e) {
    // ignore
  }
  throw new Error('No fetch available; please provide global fetch or install undici');
}

function _normalizeResponse(res) {
  const normalized = Object.create(null);
  normalized.ok = res && Boolean(res.ok);
  normalized.status = res && res.status;
  normalized.headers = res && res.headers;
  normalized.raw = res;
  normalized.json = async () => {
    if (!res) return null;
    if (typeof res.json === 'function') return res.json();
    const t = await (typeof res.text === 'function' ? res.text() : '');
    try { return JSON.parse(t); } catch (e) { return null; }
  };
  normalized.text = async () => {
    if (!res) return '';
    if (typeof res.text === 'function') return res.text();
    if (typeof res.arrayBuffer === 'function') {
      const buf = await res.arrayBuffer();
      return Buffer.from(buf).toString('utf8');
    }
    return '';
  };
  normalized.arrayBuffer = async () => {
    if (!res) return Buffer.from([]).buffer;
    if (typeof res.arrayBuffer === 'function') return res.arrayBuffer();
    if (typeof res.buffer === 'function') {
      const b = await res.buffer();
      return b.buffer ? b.buffer : Buffer.from(b).buffer;
    }
    const txt = await normalized.text();
    return Buffer.from(txt, 'utf8').buffer;
  };
  return normalized;
}

function _parseRetryAfter(header) {
  if (!header) return null;
  const s = String(header).trim();
  const n = Number(s);
  if (!Number.isNaN(n)) return n * 1000;
  const date = Date.parse(s);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, options = {}, retryOpts = {}) {
  const fetchImpl = getFetch();
  const envMaxRetries = Number(process && process.env && process.env.GITHUB_MAX_RETRIES);
  const envTimeout = Number(process && process.env && process.env.GITHUB_TIMEOUT_MS);
  const envBackoff = Number(process && process.env && process.env.GITHUB_RETRY_BASE_MS);
  const maxRetries = typeof retryOpts.retries === 'number'
    ? retryOpts.retries
    : (!Number.isNaN(envMaxRetries) ? envMaxRetries : 2);
  const timeout = typeof retryOpts.timeout === 'number'
    ? retryOpts.timeout
    : (!Number.isNaN(envTimeout) ? envTimeout : 15000);
  const backoffBase = typeof retryOpts.backoffBase === 'number'
    ? retryOpts.backoffBase
    : (!Number.isNaN(envBackoff) ? envBackoff : 200);
  const onRetry = typeof retryOpts.onRetry === 'function' ? retryOpts.onRetry : undefined;
  const onEvent = typeof retryOpts.onEvent === 'function' ? retryOpts.onEvent : undefined;
  const headers = Object.assign({}, options.headers || {});
  if (!headers.accept) headers.accept = 'application/vnd.github+json';
  if (process && process.env && process.env.GITHUB_TOKEN && !headers.authorization && !headers.Authorization) {
    headers.authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  let attempt = 0;
  // generate a lightweight correlation id for this logical request
  const generateId = () => {
    try {
      if (typeof (globalThis.crypto && globalThis.crypto.randomUUID) === 'function') return globalThis.crypto.randomUUID();
      if (typeof require === 'function') {
        try { const c = require('crypto'); if (typeof c.randomUUID === 'function') return c.randomUUID(); } catch (_) {}
      }
    } catch (_) {}
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xfffffff).toString(36)}`;
  };
  const requestId = generateId();
  if (onEvent) {
    try { onEvent({ type: 'request.start', id: requestId, url, options }); } catch (_) {}
  }
  let lastErr = null;
  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    const sig = controller ? controller.signal : undefined;
    let timer = null;
    try {
      if (controller) timer = setTimeout(() => controller.abort(), timeout);
      // attach correlation id header if not present
      if (headers && !headers['x-request-id'] && !headers['X-Request-Id']) {
        headers['x-request-id'] = requestId;
      }
      const res = await fetchImpl(url, Object.assign({}, options, { headers, signal: sig }));
      if (timer) clearTimeout(timer);
      // If status is rate limited or server error, consider retry
      const status = res && res.status ? res.status : 0;
      if ((status === 429 || (status >= 500 && status < 600)) && attempt <= maxRetries) {
        const ra = _parseRetryAfter(res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : res.headers && res.headers['retry-after']);
        const delay = ra !== null ? ra : Math.min(10000, backoffBase * Math.pow(2, attempt - 1));
        if (onRetry) {
          try { onRetry({ attempt, url, reason: status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', status, retryAfter: ra, id: requestId }); } catch (_) {}
        }
        if (onEvent) {
          try { onEvent({ type: 'request.retry', id: requestId, attempt, url, reason: status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', status, retryAfter: ra, delay }); } catch (_) {}
        }
        
        await _sleep(delay + Math.floor(Math.random() * 50));
        lastErr = { type: status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', status, retryAfter: ra, message: `Retrying on status ${status}` };
        continue;
      }
      return _normalizeResponse(res);
    } catch (err) {
      if (timer) clearTimeout(timer);
      // AbortError or network error
      const isAbort = err && err.name === 'AbortError';
      if (isAbort && attempt > maxRetries) {
        const e = { type: 'TIMEOUT', message: 'Request timed out', original: err };
        if (onEvent) { try { onEvent({ type: 'request.failure', id: requestId, url, attempt, error: e }); } catch (_) {} }
        throw e;
      }
      if (attempt <= maxRetries) {
        const delay = Math.min(10000, backoffBase * Math.pow(2, attempt - 1));
        if (onRetry) {
          try { onRetry({ attempt, url, reason: isAbort ? 'ABORT' : 'NETWORK', message: err && err.message, id: requestId }); } catch (_) {}
        }
        if (onEvent) {
          try { onEvent({ type: 'request.retry', id: requestId, attempt, url, reason: isAbort ? 'ABORT' : 'NETWORK', message: err && err.message, delay }); } catch (_) {}
        }
        
        await _sleep(delay + Math.floor(Math.random() * 50));
        lastErr = { type: isAbort ? 'TIMEOUT' : 'NETWORK', message: err && err.message, original: err };
        continue;
      }
      if (onEvent) { try { onEvent({ type: 'request.failure', id: requestId, url, attempt, error: err }); } catch (_) {} }
      throw { type: 'NETWORK', message: err && err.message, original: err };
    }
  }
  // If we exit loop, throw lastErr or generic
  if (onEvent) { try { onEvent({ type: 'request.failure', id: requestId, url, attempt: maxRetries + 1, error: lastErr || { type: 'NETWORK', message: 'fetch failed after retries' } }); } catch (_) {} }
  throw lastErr || { type: 'NETWORK', message: 'fetch failed after retries' };
}

async function doFetch(url, options = {}, retryOpts = {}) {
  const res = await fetchWithRetry(url, options, retryOpts);
  return res;
}

async function listArtifacts(owner, repo) {
  if (!owner || !repo) return [];
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
  const res = await doFetch(url, { method: 'GET' });
  if (!res.ok) return [];
  const j = await res.json();
  return j && j.artifacts ? j.artifacts : [];
}

async function downloadArtifactZip(artifactId, opts = {}) {
  const owner = opts.owner;
  const repo = opts.repo;
  if (!owner || !repo) throw new Error('owner and repo required to download artifact');
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`;
  const res = await doFetch(url, { method: 'GET', headers: { accept: 'application/zip' } });
  if (!res.ok) throw new Error(`artifact download failed: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function postComment(owner, repo, issueNumber, body) {
  if (!owner || !repo || !issueNumber) throw new Error('owner/repo/issueNumber required');
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
  const res = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) });
  return res.ok ? await res.json() : null;
}

async function patchIssue(owner, repo, issueNumber, payload) {
  if (!owner || !repo || !issueNumber) throw new Error('owner/repo/issueNumber required');
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const res = await doFetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok ? await res.json() : null;
}

async function listIssues(owner, repo, query) {
  if (!owner || !repo) return [];
  let url = `https://api.github.com/repos/${owner}/${repo}/issues`;
  if (query) {
    if (typeof query === 'string') {
      // allow passing raw query string or starting with '?'
      url = url + (query.startsWith('?') ? query : `?${query}`);
    } else if (typeof query === 'object') {
      const params = new URLSearchParams();
      for (const k of Object.keys(query)) {
        const v = query[k];
        if (v === undefined || v === null) continue;
        params.append(k, String(v));
      }
      const qs = params.toString();
      if (qs) url = url + `?${qs}`;
    }
  }
  const res = await doFetch(url, { method: 'GET' });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : (j && j.items ? j.items : []);
}

module.exports = {
  doFetch,
  listArtifacts,
  listIssues,
  downloadArtifactZip,
  postComment,
  patchIssue
};

const Buffer = require('buffer').Buffer;

function makeJsonResponse(obj, status = 200) {
  const bodyStr = JSON.stringify(obj);
  const b = Buffer.from(bodyStr, 'utf8');
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    arrayBuffer: async () => ab,
    text: async () => bodyStr,
    json: async () => obj,
  };
}

function makeBufferResponse(bufIn, status = 200, contentType = 'application/zip') {
  const b = Buffer.from(bufIn);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () => ab,
    text: async () => b.toString('utf8'),
    json: async () => { throw new Error('not json'); },
  };
}

// create a focused GitHub fetch mock suited for tests that exercise
// artifacts -> zip -> issues -> comments/patch flows
module.exports = function createFetchMock({ artifactId, zipBuffer, artifacts, closedIssue }) {
  // artifacts: optional array of { id, zipBuffer }
  const patchedBodies = [];
  const postComments = [];
  let originalFetch = global.fetch;

  // normalize input for backward compatibility
  let artifactsList = [];
  const idToBuffer = new Map();
  if (Array.isArray(artifacts) && artifacts.length) {
    artifactsList = artifacts.map(a => ({ id: a.id, name: a.name || 'slow-tests', created_at: a.created_at || '2026-01-01T00:00:00Z' }));
    for (const a of artifacts) idToBuffer.set(String(a.id), a.zipBuffer);
  } else if (artifactId) {
    artifactsList = [{ id: artifactId, name: 'slow-tests', created_at: '2026-01-01T00:00:00Z' }];
    if (zipBuffer) idToBuffer.set(String(artifactId), zipBuffer);
  }

  function install() {
    originalFetch = global.fetch;
    const calls = Object.create(null);
    global.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init && init.method) || 'GET';
      try { const u = new URL(url); const key = `${method} ${u.pathname}`; calls[key] = (calls[key] || 0) + 1; } catch (e) {}
      if (url.endsWith('/actions/artifacts') && method === 'GET') {
        return makeJsonResponse({ artifacts: artifactsList }, 200);
      }
      // match .../actions/artifacts/{id}/zip
      const m = url.match(/\/actions\/artifacts\/(\d+)\/zip$/);
      if (m && method === 'GET') {
        const id = m[1];
        if (idToBuffer.has(String(id))) {
          return makeBufferResponse(idToBuffer.get(String(id)), 200, 'application/zip');
        }
        return makeJsonResponse({}, 404);
      }
      // If requesting a specific issue by number, return single issue object
      const issueNumMatch = url.match(/\/repos\/[^\/]+\/[^\/]+\/issues\/(\d+)(?:$|\?)/);
      if (issueNumMatch && method === 'GET') {
        return makeJsonResponse(Object.assign({}, closedIssue), 200);
      }
      if (url.includes('/issues') && method === 'GET') {
        return makeJsonResponse([Object.assign({}, closedIssue)], 200);
      }
      // POST to create an issue
      if (url.endsWith('/issues') && method === 'POST') {
        const body = init && init.body ? JSON.parse(init.body) : null;
        // return an object with a number to mimic GitHub
        const created = { number: closedIssue && closedIssue.number ? closedIssue.number : 999 };
        return makeJsonResponse(created, 201);
      }
      const issueNumber = closedIssue && closedIssue.number;
      if (issueNumber && url.endsWith(`/issues/${issueNumber}/comments`) && method === 'POST') {
        const body = init && init.body ? JSON.parse(init.body) : null;
        postComments.push(body);
        return makeJsonResponse({}, 201);
      }
      if (issueNumber && url.endsWith(`/issues/${issueNumber}`) && method === 'PATCH') {
        const body = init && init.body ? JSON.parse(init.body) : null;
        patchedBodies.push(body);
        return makeJsonResponse({ number: issueNumber }, 200);
      }
      return makeJsonResponse({}, 404);
    };
    return { patchedBodies, postComments, calls, restore };
  }

  function restore() {
    try { global.fetch = originalFetch; } catch (e) {}
  }

  return { install, restore, patchedBodies, postComments };
};

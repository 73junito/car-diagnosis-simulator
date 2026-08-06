const { isGroundedResponseShape } = require('../src/tutor/groundedResponseSchema');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

describe('/api/tutor/grounded', () => {
  test('response schema enforced for grounded response', async () => {
    const { createGroundedHandler } = require('../api/tutor/grounded');
    const handler = createGroundedHandler({
      retrieval: async () => ({ status: 'sufficient', evidence: [{ id: 1 }] }),
      assembler: async () => ({
        status: 'ready',
        citations: [{ label: 'C1', sourceId: 'source-001', chunkId: 'chunk-001', locator: 'L1', title: 'Approved Source', pageStart: 118, pageEnd: 121 }],
        promptEvidence: ['[C1] excerpt']
      }),
      generator: async () => 'Inspect starter control circuit first. [C1]'
    });

    const req = { method: 'POST', body: { query: 'starter no crank' } };
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(isGroundedResponseShape(res.body)).toBe(true);
    expect(res.body.status).toBe('grounded');
  });

  test('response schema enforced for insufficient response', async () => {
    const { createGroundedHandler } = require('../api/tutor/grounded');
    const handler = createGroundedHandler({
      retrieval: async () => ({ status: 'insufficient', reason: 'INSUFFICIENT_APPROVED_EVIDENCE' }),
      assembler: async () => ({ status: 'ready', citations: [{ label: 'C1', sourceId: 's', chunkId: 'c', locator: 'L' }], promptEvidence: ['[C1] x'] }),
      generator: async () => 'x [C1]'
    });

    const req = { method: 'POST', body: { query: 'starter no crank' } };
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(isGroundedResponseShape(res.body)).toBe(true);
    expect(res.body.status).toBe('insufficient');
    expect(res.body.reason).toBe('INSUFFICIENT_APPROVED_EVIDENCE');
  });

  test('rejects empty query', async () => {
    const { createGroundedHandler } = require('../api/tutor/grounded');
    const handler = createGroundedHandler({
      retrieval: async () => ({ status: 'sufficient', evidence: [{ id: 1 }] }),
      assembler: async () => ({ status: 'ready', citations: [{ label: 'C1', sourceId: 's', chunkId: 'c', locator: 'L' }], promptEvidence: ['[C1] x'] }),
      generator: async () => 'x [C1]'
    });

    const req = { method: 'POST', body: { query: '' } };
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('insufficient');
    expect(res.body.reason).toBe('EMPTY_QUERY');
  });

  test('method not allowed for non-POST', async () => {
    const { createGroundedHandler } = require('../api/tutor/grounded');
    const handler = createGroundedHandler();
    const req = { method: 'GET', body: {} };
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'method_not_allowed' });
  });
});

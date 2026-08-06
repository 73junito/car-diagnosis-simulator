const { groundTutorResponse } = require('../../src/tutor/groundingService');
const { normalizeGroundedPayload } = require('../../src/tutor/groundedResponseSchema');

function createGroundedHandler(deps = {}) {
  const retrieval = deps.retrieval || (async () => ({
    status: 'insufficient',
    evidence: [],
    reason: 'INSUFFICIENT_APPROVED_EVIDENCE'
  }));
  const assembler = deps.assembler || (async () => ({
    status: 'insufficient',
    citations: [],
    promptEvidence: [],
    reason: 'INVALID_OR_INCOMPLETE_CITATIONS'
  }));
  const generator = deps.generator || (async () => {
    throw new Error('generator not configured');
  });

  return async function groundedHandler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = req.body || {};
    const query = typeof body.query === 'string' ? body.query : '';

    const result = await groundTutorResponse({
      query,
      retrieval,
      assembler,
      generator
    });

    return res.status(200).json(normalizeGroundedPayload(result));
  };
}

module.exports = createGroundedHandler();
module.exports.createGroundedHandler = createGroundedHandler;

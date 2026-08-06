function validateCitation(citation) {
  if (!citation || typeof citation !== 'object') return false;
  if (!citation.label || typeof citation.label !== 'string') return false;
  if (!citation.sourceId || typeof citation.sourceId !== 'string') return false;
  if (!citation.chunkId || typeof citation.chunkId !== 'string') return false;
  if (!citation.locator || typeof citation.locator !== 'string') return false;
  return true;
}

function isGroundedResponseShape(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.status === 'grounded') {
    if (typeof payload.answer !== 'string' || payload.answer.trim().length === 0) return false;
    if (!Array.isArray(payload.citations) || payload.citations.length === 0) return false;
    if (payload.reason !== null) return false;
    return payload.citations.every(validateCitation);
  }
  if (payload.status === 'insufficient') {
    if (payload.answer !== null) return false;
    if (!Array.isArray(payload.citations) || payload.citations.length !== 0) return false;
    if (!payload.reason || typeof payload.reason !== 'string') return false;
    return true;
  }
  return false;
}

function normalizeGroundedPayload(payload) {
  if (isGroundedResponseShape(payload)) return payload;
  return {
    status: 'insufficient',
    answer: null,
    citations: [],
    reason: 'INVALID_GROUNDED_RESPONSE_SCHEMA'
  };
}

module.exports = {
  validateCitation,
  isGroundedResponseShape,
  normalizeGroundedPayload
};

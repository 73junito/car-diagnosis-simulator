const { validateCitationsAgainstRetrievedEvidence } = require('../rala/validators');

function makeInsufficient(reason) {
  return {
    status: 'insufficient',
    answer: null,
    citations: [],
    reason: reason || 'INSUFFICIENT_APPROVED_EVIDENCE'
  };
}

function extractCitationLabels(answerText) {
  const labels = new Set();
  const matches = String(answerText || '').match(/\[C\d+\]/g) || [];
  for (const m of matches) labels.add(m.slice(1, -1));
  return Array.from(labels).sort((a, b) => {
    const ai = Number(a.slice(1));
    const bi = Number(b.slice(1));
    return ai - bi;
  });
}

function validateAnswerCitations(answerText, allowedLabels) {
  const found = extractCitationLabels(answerText);
  if (found.length === 0) {
    return { ok: false, reason: 'MISSING_REQUIRED_CITATIONS' };
  }
  for (const label of found) {
    if (!allowedLabels.has(label)) {
      return { ok: false, reason: 'UNKNOWN_CITATION_LABEL' };
    }
  }
  return { ok: true, found };
}

async function groundTutorResponse({ query, retrieval, assembler, generator }) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return makeInsufficient('EMPTY_QUERY');
  }
  if (typeof retrieval !== 'function') throw new Error('retrieval function is required');
  if (typeof assembler !== 'function') throw new Error('assembler function is required');
  if (typeof generator !== 'function') throw new Error('generator function is required');

  const retrievalResult = await retrieval(query);
  if (!retrievalResult || retrievalResult.status !== 'sufficient') {
    return makeInsufficient((retrievalResult && retrievalResult.reason) || 'INSUFFICIENT_APPROVED_EVIDENCE');
  }

  let evidenceResult;
  try {
    evidenceResult = await assembler(retrievalResult);
  } catch (_err) {
    return makeInsufficient('INVALID_OR_INCOMPLETE_CITATIONS');
  }

  if (!evidenceResult || evidenceResult.status !== 'ready') {
    return makeInsufficient((evidenceResult && evidenceResult.reason) || 'INVALID_OR_INCOMPLETE_CITATIONS');
  }

  const citations = Array.isArray(evidenceResult.citations) ? evidenceResult.citations : [];
  const promptEvidence = Array.isArray(evidenceResult.promptEvidence) ? evidenceResult.promptEvidence : [];
  if (citations.length === 0 || promptEvidence.length === 0) {
    return makeInsufficient('INSUFFICIENT_APPROVED_EVIDENCE');
  }

  const retrievedEvidence = Array.isArray(retrievalResult.evidence) ? retrievalResult.evidence : [];
  const hasAnchoredRetrievedEvidence = retrievedEvidence.some(item => {
    if (!item || typeof item !== 'object') return false;
    return Boolean(item.chunkId || item.sourceId || item.citationLabel);
  });

  if (hasAnchoredRetrievedEvidence) {
    const evidenceValidation = validateCitationsAgainstRetrievedEvidence(citations, retrievedEvidence);
    if (!evidenceValidation.ok) {
      return makeInsufficient(evidenceValidation.reason);
    }
  }

  const allowedCitationLabels = citations.map(citation => citation.label).filter(Boolean);
  if (allowedCitationLabels.length === 0) {
    return makeInsufficient('INVALID_OR_INCOMPLETE_CITATIONS');
  }

  let answer;
  try {
    answer = await generator({
      query,
      promptEvidence,
      allowedCitationLabels
    });
  } catch (_err) {
    return makeInsufficient('GENERATION_FAILED');
  }

  if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
    return makeInsufficient('GENERATION_FAILED');
  }

  const allowedSet = new Set(allowedCitationLabels);
  const citationsValidation = validateAnswerCitations(answer, allowedSet);
  if (!citationsValidation.ok) {
    return makeInsufficient(citationsValidation.reason);
  }

  return {
    status: 'grounded',
    answer,
    citations,
    reason: null
  };
}

module.exports = {
  groundTutorResponse,
  validateAnswerCitations,
  extractCitationLabels
};

function resolveCitation(evidenceItem, metadataStore) {
  if (!evidenceItem || typeof evidenceItem !== 'object') throw new Error('invalid evidence item');
  const { embeddingId, chunkId, sourceId, text } = evidenceItem;
  if (!sourceId) throw new Error('missing sourceId');
  if (!chunkId) throw new Error('missing chunkId');
  if (!text || typeof text !== 'string' || text.trim().length === 0) throw new Error('missing evidence text');

  const all = metadataStore && typeof metadataStore.all === 'function' ? metadataStore.all() : [];
  const meta = all.find(r => (r.id === embeddingId) || (r.chunkId === chunkId && r.sourceId === sourceId));
  if (!meta) throw new Error('unresolved citation');

  // ensure active/approved
  if (meta.superseded_by) throw new Error('superseded evidence');
  if (meta.sourceStatus && meta.sourceStatus !== 'approved') throw new Error('source not approved');
  if (meta.chunkStatus && meta.chunkStatus !== 'approved') throw new Error('chunk not approved');
  if (meta.chunkDeleted) throw new Error('chunk deleted');

  // required locator and title
  if (!meta.locator) throw new Error('missing locator');
  if (!meta.title) meta.title = null;

  return {
    embeddingId: meta.id || embeddingId,
    chunkId: meta.chunkId || chunkId,
    sourceId: meta.sourceId || sourceId,
    title: meta.title || null,
    sourceVersion: meta.sourceVersion || null,
    locator: meta.locator,
    pageStart: meta.pageStart || null,
    pageEnd: meta.pageEnd || null,
    text: evidenceItem.text || meta.text || meta.text_excerpt || null
  };
}

function validateEvidenceSet(items) {
  if (!Array.isArray(items)) throw new Error('evidence must be array');
  for (const it of items) {
    if (!it.sourceId || !it.chunkId || !it.locator || !it.text) return false;
  }
  return true;
}

function assembleTutorEvidence(retrievalResult, metadataStore) {
  if (!retrievalResult || retrievalResult.status !== 'sufficient') return { status: 'insufficient', citations: [], promptEvidence: [], reason: 'INVALID_OR_INCOMPLETE_CITATIONS' };

  const seen = new Set();
  const citations = [];
  const promptEvidence = [];

  for (let i = 0; i < retrievalResult.evidence.length; i++) {
    const ev = retrievalResult.evidence[i];
    try {
      const resolved = resolveCitation(ev, metadataStore);
      const key = `${resolved.sourceId}::${resolved.chunkId}`;
      if (seen.has(key)) continue; // duplicate collapse
      seen.add(key);

      const label = `C${citations.length + 1}`;
      citations.push(Object.assign({ label }, resolved));
      promptEvidence.push(`[${label}] ${resolved.text}`);
    } catch (err) {
      return { status: 'insufficient', citations: [], promptEvidence: [], reason: 'INVALID_OR_INCOMPLETE_CITATIONS' };
    }
  }

  if (!validateEvidenceSet(citations)) return { status: 'insufficient', citations: [], promptEvidence: [], reason: 'INVALID_OR_INCOMPLETE_CITATIONS' };

  return { status: 'ready', citations, promptEvidence };
}

module.exports = { resolveCitation, validateEvidenceSet, assembleTutorEvidence };

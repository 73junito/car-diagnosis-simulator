function requireString(value, message) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function createRetrievalContext({
  query,
  queryEmbedding = null,
  filters = { approvedOnly: true },
  topK = 20,
  minScore = 0,
  provider,
  metadataStore,
  vectorStore,
  diagnostics = {},
  requireProvider = true,
  requireVectorStore = false
}) {
  requireString(query, 'empty query rejected');
  if (requireProvider && (!provider || typeof provider.embedTexts !== 'function')) throw new Error('provider required');
  if (!metadataStore || typeof metadataStore.all !== 'function') throw new Error('metadataStore required');
  if (requireVectorStore && (!vectorStore || typeof vectorStore.getVector !== 'function')) throw new Error('vectorStore required');

  const context = {
    query,
    queryEmbedding,
    filters,
    topK,
    minScore,
    provider,
    metadataStore,
    vectorStore,
    diagnostics
  };

  return deepFreeze(context);
}

function withContext(context, overrides = {}) {
  return createRetrievalContext({
    query: overrides.query || context.query,
    queryEmbedding: Object.prototype.hasOwnProperty.call(overrides, 'queryEmbedding')
      ? overrides.queryEmbedding
      : context.queryEmbedding,
    filters: overrides.filters || context.filters,
    topK: Object.prototype.hasOwnProperty.call(overrides, 'topK') ? overrides.topK : context.topK,
    minScore: Object.prototype.hasOwnProperty.call(overrides, 'minScore') ? overrides.minScore : context.minScore,
    provider: overrides.provider || context.provider,
    metadataStore: overrides.metadataStore || context.metadataStore,
    vectorStore: Object.prototype.hasOwnProperty.call(overrides, 'vectorStore') ? overrides.vectorStore : context.vectorStore,
    diagnostics: overrides.diagnostics || context.diagnostics,
    requireProvider: Object.prototype.hasOwnProperty.call(overrides, 'requireProvider') ? overrides.requireProvider : true,
    requireVectorStore: Object.prototype.hasOwnProperty.call(overrides, 'requireVectorStore') ? overrides.requireVectorStore : false
  });
}

module.exports = {
  createRetrievalContext,
  withContext
};

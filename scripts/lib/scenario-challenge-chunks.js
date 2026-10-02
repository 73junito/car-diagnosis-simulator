'use strict';

function buildGenerationChunks({ allocation, scenarioOrder, maxQuestions = 12 }) {
  if (!allocation || typeof allocation !== 'object') {
    throw new Error('Challenge allocation is required.');
  }
  if (!Array.isArray(scenarioOrder) || scenarioOrder.length === 0) {
    throw new Error('Scenario order is required.');
  }
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1) {
    throw new Error('maxQuestions must be a positive integer.');
  }

  const allocationKeys = Object.keys(allocation);
  const unknown = allocationKeys.filter((scenarioId) => !scenarioOrder.includes(scenarioId));
  if (unknown.length > 0) {
    throw new Error('Allocation contains scenarios not present in scenarioOrder: ' + unknown.join(', '));
  }

  const chunks = [];
  let current = { scenario_ids: [], allocation: {}, target_count: 0 };

  for (const scenarioId of scenarioOrder) {
    if (!(scenarioId in allocation)) continue;

    const count = allocation[scenarioId];
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('Allocation for ' + scenarioId + ' must be a positive integer.');
    }
    if (count > maxQuestions) {
      throw new Error('Allocation for ' + scenarioId + ' exceeds maxQuestions.');
    }

    if (current.target_count > 0 && current.target_count + count > maxQuestions) {
      chunks.push(current);
      current = { scenario_ids: [], allocation: {}, target_count: 0 };
    }

    current.scenario_ids.push(scenarioId);
    current.allocation[scenarioId] = count;
    current.target_count += count;
  }

  if (current.target_count > 0) chunks.push(current);

  const plannedTotal = allocationKeys.reduce((sum, scenarioId) => sum + allocation[scenarioId], 0);
  const chunkTotal = chunks.reduce((sum, chunk) => sum + chunk.target_count, 0);
  if (plannedTotal !== chunkTotal) {
    throw new Error('Chunked allocation total does not match the batch allocation.');
  }

  return chunks;
}

module.exports = { buildGenerationChunks };

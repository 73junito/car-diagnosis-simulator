const fs = require('fs');
const path = require('path');

function validateDatasetRow(row, index) {
  if (!row || typeof row !== 'object') throw new Error(`dataset row ${index} must be an object`);
  if (!row.id || typeof row.id !== 'string') throw new Error(`dataset row ${index} missing id`);
  if (!row.query || typeof row.query !== 'string') throw new Error(`dataset row ${index} missing query`);
  if (!Array.isArray(row.relevantChunkIds) || row.relevantChunkIds.length === 0) {
    throw new Error(`dataset row ${index} must include non-empty relevantChunkIds`);
  }
}

function validateDataset(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) throw new Error('empty benchmark rejected');
  dataset.forEach((row, i) => validateDatasetRow(row, i));
  return dataset;
}

function loadDatasetFromFile(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw);
  return validateDataset(parsed);
}

module.exports = {
  validateDatasetRow,
  validateDataset,
  loadDatasetFromFile
};

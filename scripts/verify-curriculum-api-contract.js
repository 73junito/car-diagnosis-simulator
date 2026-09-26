'use strict';

/**
 * Validates a curriculum read API response against the same static contract
 * consumed from data/curriculum/* (the source used by /learning-path/ until
 * this API is contract-validated).
 *
 * Usage:
 *   node scripts/verify-curriculum-api-contract.js --file <response.json>
 *   node scripts/verify-curriculum-api-contract.js --url <endpoint-url>
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const COLLECTIONS = ['pathways', 'courses', 'competencies', 'lessonPlans', 'scenarioMappings'];
const TOP_LEVEL_KEYS = ['schemaVersion', ...COLLECTIONS];

function loadStaticContract(targetRoot = root) {
  const readJson = (relative) =>
    JSON.parse(fs.readFileSync(path.join(targetRoot, 'data', 'curriculum', relative), 'utf8'));

  const pathwaysDoc = readJson('academic-pathways.json');
  const undergraduate = readJson('undergraduate-courses.json');
  const graduate = readJson('graduate-courses.json');
  const competenciesDoc = readJson('competencies.json');
  const lessonPlansDoc = readJson('lesson-plans.json');
  const mappingsDoc = readJson('scenario-mappings.json');

  return {
    schemaVersion: pathwaysDoc.schemaVersion,
    pathways: pathwaysDoc.pathways,
    courses: [...undergraduate.courses, ...graduate.courses],
    competencies: competenciesDoc.competencies,
    lessonPlans: lessonPlansDoc.lessonPlans,
    scenarioMappings: mappingsDoc.scenarioMappings
  };
}

function idKeyFor(collection) {
  return collection === 'scenarioMappings' ? 'scenarioId' : 'id';
}

function compareRecord(label, expected, actual, errors) {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();

  if (expectedKeys.join(',') !== actualKeys.join(',')) {
    errors.push(
      `${label} field set mismatch: expected [${expectedKeys.join(', ')}] got [${actualKeys.join(', ')}]`
    );
    return;
  }

  for (const key of expectedKeys) {
    const expectedValue = expected[key];
    const actualValue = actual[key];
    if (Array.isArray(expectedValue)) {
      const equal =
        Array.isArray(actualValue) &&
        actualValue.length === expectedValue.length &&
        expectedValue.every((value, index) => value === actualValue[index]);
      if (!equal) {
        errors.push(`${label}.${key} sequence mismatch`);
      }
    } else if (actualValue !== expectedValue) {
      errors.push(
        `${label}.${key} mismatch: expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValue)}`
      );
    }
  }
}


function validateCurriculumApiContract(payload, staticContract) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['payload must be a JSON object'];
  }

  const errors = [];
  const payloadKeys = Object.keys(payload).sort().join(',');
  const expectedTopLevel = [...TOP_LEVEL_KEYS].sort().join(',');
  if (payloadKeys !== expectedTopLevel) {
    errors.push(
      `top-level keys must be exactly [${expectedTopLevel}] but got [${payloadKeys}]`
    );
  }

  if (payload.schemaVersion !== staticContract.schemaVersion) {
    errors.push(
      `schemaVersion mismatch: expected ${staticContract.schemaVersion} got ${JSON.stringify(payload.schemaVersion)}`
    );
  }

  for (const collection of COLLECTIONS) {
    const items = payload[collection];
    if (!Array.isArray(items)) {
      errors.push(`${collection} must be an array`);
      continue;
    }

    const idKey = idKeyFor(collection);
    const expectedItems = staticContract[collection];
    const actualById = new Map();

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        errors.push(`${collection} entries must be objects`);
        continue;
      }
      const id = item[idKey];
      if (typeof id !== 'string' || id.length === 0) {
        errors.push(`${collection} entry missing ${idKey}`);
        continue;
      }
      if (actualById.has(id)) {
        errors.push(`duplicate ${collection} entry ${id}`);
      }
      actualById.set(id, item);
    }

    const expectedIdSet = new Set();
    for (const expectedItem of expectedItems) {
      const id = expectedItem[idKey];
      expectedIdSet.add(id);
      const actual = actualById.get(id);
      if (!actual) {
        errors.push(`${collection} missing ${id}`);
        continue;
      }
      compareRecord(`${collection}/${id}`, expectedItem, actual, errors);
    }

    for (const id of actualById.keys()) {
      if (!expectedIdSet.has(id)) {
        errors.push(`${collection} has unexpected entry ${id}`);
      }
    }
  }

  return errors;
}


async function loadPayload(args) {
  const fileIndex = args.indexOf('--file');
  const urlIndex = args.indexOf('--url');

  if (fileIndex !== -1 && args[fileIndex + 1]) {
    return JSON.parse(fs.readFileSync(args[fileIndex + 1], 'utf8'));
  }

  if (urlIndex !== -1 && args[urlIndex + 1]) {
    const response = await fetch(args[urlIndex + 1], {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`endpoint returned HTTP ${response.status}`);
    }
    return response.json();
  }

  throw new Error(
    'usage: node scripts/verify-curriculum-api-contract.js --file <response.json> | --url <endpoint-url>'
  );
}

async function main() {
  let payload;
  try {
    payload = await loadPayload(process.argv.slice(2));
  } catch (err) {
    console.error(`[FAIL] Curriculum API contract: ${err.message}`);
    process.exit(1);
  }

  const staticContract = loadStaticContract();
  const errors = validateCurriculumApiContract(payload, staticContract);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error(`[FAIL] Curriculum API contract violated (${errors.length} error(s))`);
    process.exit(1);
  }

  console.log(
    `[PASS] Curriculum API contract verified: ${staticContract.pathways.length} pathways, ` +
      `${staticContract.courses.length} courses, ${staticContract.competencies.length} competencies, ` +
      `${staticContract.lessonPlans.length} lesson plans, ${staticContract.scenarioMappings.length} scenario mappings`
  );
}

if (require.main === module) {
  main();
}

module.exports = { loadStaticContract, validateCurriculumApiContract };

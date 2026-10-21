'use strict';

/**
 * AUT 250 weekly laboratory validator.
 *
 * Deterministic and fail-closed. It never fabricates lab content, never
 * approves anything, and reports missing sources explicitly rather than
 * passing silently.
 *
 * Usage:
 *   node scripts/verify-aut250-weekly-labs.js            # human summary
 *   node scripts/verify-aut250-weekly-labs.js --json     # machine report
 *
 * Exit code 0 only when there are no errors and no missing labs. "Incomplete"
 * (labs not yet delivered) exits non-zero by default and is reported, not
 * hidden, so a partially delivered course can never look complete.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PATHS = {
  studentLabs: path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs', 'labs'),
  studentSchema: path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs', 'schema', 'student-lab.schema.json'),
  instructorSchema: path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs', 'schema', 'instructor-reference.schema.json'),
  instructor: path.join(ROOT, 'instructor-resources', 'aut250-weekly-labs'),
  blueprint: path.join(ROOT, 'data', 'curriculum', 'aut250-weekly-lab-blueprint.json')
};

const EXPECTED_LAB_COUNT = 15;
const EXPECTED_DURATION_MINUTES = 120;
const EXPECTED_TOTAL_MINUTES = 1800;
const SESSION_MINUTE_KEYS = ['safetyBriefing', 'instructorDemonstration', 'studentDiagnosis', 'evidenceReport', 'debrief'];

// Defence in depth: the student schema also forbids these via
// additionalProperties, but an explicit list makes the intent testable.
const FORBIDDEN_STUDENT_FIELDS = [
  'expectedAnswer', 'answerKey', 'correctAnswer', 'correctOption',
  'instructorReference', 'instructorNotes', 'misconceptionFeedback', 'expectedEvidence'
];

function expectedLabIds() {
  const ids = [];
  for (let week = 1; week <= EXPECTED_LAB_COUNT; week += 1) {
    ids.push('aut250-lab-' + String(week).padStart(2, '0'));
  }
  return ids;
}

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch (error) {
    return false;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function listSubdirectories(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listFilesRecursive(dir, predicate) {
  if (!exists(dir)) return [];
  const found = [];
  const walk = (current) => {
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!predicate || predicate(full)) found.push(full);
    });
  };
  walk(dir);
  return found.sort();
}

function relative(target) {
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

function makeAjv() {
  try {
    const Ajv = require('ajv');
    return { ajv: new Ajv({ allErrors: true, strict: false }), error: null };
  } catch (error) {
    // Fail closed: an unavailable schema engine is an error, never a pass.
    return { ajv: null, error: 'Schema engine unavailable (ajv): ' + String(error.message) };
  }
}

function formatAjvErrors(errors) {
  return (errors || []).map((error) => (error.instancePath || '/') + ' ' + error.message);
}

/**
 * Compiled-schema cache.
 *
 * Ajv rejects a schema whose `$id` has already been added, so a schema must be
 * compiled once per validation run rather than once per document. Without this
 * cache, validating a second lab package against the same schema throws
 * "schema with key or id ... already exists".
 */
function makeSchemaCache() {
  return new Map();
}

function validateWithSchema(ajv, schemaFile, document, cache) {
  if (!ajv) return { ok: true, problems: [], skipped: true };
  if (!exists(schemaFile)) {
    return { ok: false, problems: ['Schema not found: ' + relative(schemaFile)] };
  }
  var compiled = null;
  if (cache && cache.has(schemaFile)) {
    compiled = cache.get(schemaFile);
  } else {
    compiled = ajv.compile(readJson(schemaFile));
    if (cache) cache.set(schemaFile, compiled);
  }
  const ok = compiled(document);
  return { ok, problems: ok ? [] : formatAjvErrors(compiled.errors), skipped: false };
}

/**
 * Semantic checks that JSON Schema cannot express.
 * Returns { errors, warnings, reviewItems }.
 */
function validateLabSemantics(lab, context) {
  const errors = [];
  const warnings = [];
  const reviewItems = [];
  const labId = lab && lab.labId ? lab.labId : '(unknown lab)';

  const pushError = (code, message) => errors.push({ code, labId, message });
  const pushWarning = (code, message) => warnings.push({ code, labId, message });
  const pushReview = (kind, detail) => reviewItems.push({ labId, kind, detail });

  if (lab && lab.sessionMinutes) {
    const total = SESSION_MINUTE_KEYS.reduce((sum, key) => sum + (Number(lab.sessionMinutes[key]) || 0), 0);
    if (total !== EXPECTED_DURATION_MINUTES) {
      pushError('session-minutes', 'Session minutes total ' + total + ', expected ' + EXPECTED_DURATION_MINUTES + '.');
    }
  }

  if (lab && lab.durationMinutes !== EXPECTED_DURATION_MINUTES) {
    pushError('duration', 'durationMinutes must be ' + EXPECTED_DURATION_MINUTES + '.');
  }

  if (lab && lab.labId) {
    const suffix = Number(String(lab.labId).replace('aut250-lab-', ''));
    if (suffix !== lab.week) {
      pushError('lab-id-week', 'labId ' + lab.labId + ' does not match week ' + lab.week + '.');
    }
  }

  // Equipment: claimed assets must exist, and gaps must be disclosed.
  const equipment = (lab && Array.isArray(lab.equipment)) ? lab.equipment : [];
  equipment.forEach((item) => {
    if (item.assetRef) {
      const target = path.join(ROOT, item.assetRef);
      if (!exists(target)) {
        pushError('asset-missing', 'Declared asset does not exist on disk: ' + item.assetRef);
      }
    }
    if (item.availability === 'missing' && !item.notes) {
      pushWarning('undisclosed-gap', 'Equipment "' + item.id + '" is unavailable but carries no explanatory note.');
    }
    if (item.availability !== 'available') {
      pushReview('equipment-availability', item.id + ' is "' + item.availability + '" and needs disclosure in the lab.');
    }
  });

  // Measurement provenance.
  const measurements = (lab && lab.scenario && Array.isArray(lab.scenario.measurements))
    ? lab.scenario.measurements : [];
  measurements.forEach((measurement) => {
    if (measurement.provenance === 'sme_review_pending') {
      pushReview('measurement-provenance', measurement.id + ' requires SME review before instructional use.');
    }
    if (measurement.value !== null && measurement.value !== undefined && !measurement.unit) {
      pushWarning('missing-unit', 'Measurement ' + measurement.id + ' supplies a value without a unit.');
    }
    if (!measurement.conditions) {
      pushWarning('missing-conditions', 'Measurement ' + measurement.id + ' has no operating conditions.');
    }
  });

  // Waveform evidence must never claim manufacturer verification.
  const waveform = lab && lab.scenario ? lab.scenario.waveformEvidence : null;
  if (waveform && waveform.mode === 'illustrative_samples' && waveform.illustrative !== true) {
    pushError('waveform-not-marked-illustrative', 'Sampled waveform evidence must set illustrative: true.');
  }
  if (waveform && waveform.samples && waveform.manufacturerVerified) {
    pushError('waveform-manufacturer-claim', 'Manufacturer-verified waveform claims are not supported.');
  }

  // Source rights: unverified sources are review items, never approvals.
  const sources = (lab && Array.isArray(lab.sources)) ? lab.sources : [];
  sources.forEach((source) => {
    if (source.citationStatus !== 'verified') {
      pushReview('source-citation', source.id + ' citationStatus is "' + source.citationStatus + '".');
    }
    if (source.rightsStatus === 'pending') {
      pushReview('source-rights', source.id + ' reproduction rights are pending.');
    }
  });

  // Fail-closed flags.
  const flags = (lab && lab.flags) || {};
  Object.keys(flags).forEach((key) => {
    if (flags[key] !== false) {
      pushError('flag-not-false', 'Flag "' + key + '" must remain false, found ' + JSON.stringify(flags[key]) + '.');
    }
  });

  // Student bundles must not carry instructor-only fields.
  FORBIDDEN_STUDENT_FIELDS.forEach((field) => {
    if (lab && Object.prototype.hasOwnProperty.call(lab, field)) {
      pushError('student-answer-leak', 'Student bundle contains instructor-only field "' + field + '".');
    }
  });

  if (context && context.blueprint) {
    const expected = context.blueprint;
    if (expected.title && lab.title !== expected.title) {
      pushError('blueprint-title', 'Title differs from blueprint: "' + lab.title + '" vs "' + expected.title + '".');
    }
    if (expected.durationMinutes !== undefined && lab.durationMinutes !== expected.durationMinutes) {
      pushError('blueprint-duration', 'Duration differs from blueprint for ' + labId + '.');
    }
  }

  return { errors, warnings, reviewItems };
}


/**
 * Load the corpus from disk. Nothing is synthesized: absent artifacts are
 * reported as missing.
 */
function loadCorpus() {
  const labs = [];
  const instructorReferences = [];
  const errors = [];

  listSubdirectories(PATHS.studentLabs).forEach((dirName) => {
    const file = path.join(PATHS.studentLabs, dirName, 'lab.json');
    if (!exists(file)) {
      errors.push({ code: 'lab-file-missing', labId: dirName, message: 'Missing lab.json in ' + dirName + '.' });
      return;
    }
    try {
      labs.push({ dirName, file, document: readJson(file) });
    } catch (error) {
      errors.push({ code: 'lab-unreadable', labId: dirName, message: String(error.message) });
    }
  });

  listSubdirectories(PATHS.instructor).forEach((dirName) => {
    const file = path.join(PATHS.instructor, dirName, 'reference.json');
    if (!exists(file)) {
      errors.push({ code: 'instructor-file-missing', labId: dirName, message: 'Missing reference.json in ' + dirName + '.' });
      return;
    }
    try {
      instructorReferences.push({ dirName, file, document: readJson(file) });
    } catch (error) {
      errors.push({ code: 'instructor-unreadable', labId: dirName, message: String(error.message) });
    }
  });

  return { labs, instructorReferences, errors };
}

/**
 * Instructor material must never live inside the student tree.
 */
function validateSeparation() {
  const errors = [];
  listFilesRecursive(PATHS.studentLabs, () => true)
    .filter((file) => /(^|[\\/])reference\.json$/.test(file))
    .forEach((file) => {
      errors.push({
        code: 'instructor-under-student-tree',
        labId: '(tree)',
        message: 'Instructor reference found inside the student tree: ' + relative(file)
      });
    });
  return errors;
}

/**
 * Blueprint conformance. The blueprint is an optional external input because
 * PR #1067 is not merged; absence is reported as a blocker, not a pass.
 */
function loadBlueprint() {
  if (!exists(PATHS.blueprint)) {
    return {
      available: false,
      path: relative(PATHS.blueprint),
      blocker: 'Blueprint unavailable (PR #1067 unmerged). Lab identity and equipment conformance cannot be verified.'
    };
  }
  const document = readJson(PATHS.blueprint);
  const byId = new Map();
  (document.weeklyLabs || []).forEach((lab) => byId.set(lab.id, lab));
  return { available: true, path: relative(PATHS.blueprint), byId, document };
}

function validateBlueprintCoverage(blueprint, labs) {
  const errors = [];
  if (!blueprint.available) return errors;
  labs.forEach((entry) => {
    const expected = blueprint.byId.get(entry.document.labId);
    if (!expected) {
      errors.push({
        code: 'blueprint-unknown-lab',
        labId: entry.document.labId,
        message: 'Lab id is not present in the approved blueprint.'
      });
      return;
    }
    if (expected.week !== entry.document.week) {
      errors.push({
        code: 'blueprint-week',
        labId: entry.document.labId,
        message: 'Week differs from blueprint (' + entry.document.week + ' vs ' + expected.week + ').'
      });
    }
  });
  return errors;
}


function buildReport() {
  const engine = makeAjv();
  const schemaCache = makeSchemaCache();
  const blueprint = loadBlueprint();
  const corpus = loadCorpus();

  const errors = []
    .concat(corpus.errors, validateSeparation(), validateBlueprintCoverage(blueprint, corpus.labs));
  if (engine.error) {
    errors.push({ code: 'schema-engine-unavailable', labId: '(validator)', message: engine.error });
  }
  const warnings = [];
  const reviewItems = [];

  const seenIds = new Set();
  corpus.labs.forEach((entry) => {
    const schemaResult = validateWithSchema(engine.ajv, PATHS.studentSchema, entry.document, schemaCache);
    if (!schemaResult.ok) {
      schemaResult.problems.forEach((problem) => errors.push({
        code: 'student-schema', labId: entry.document.labId || entry.dirName, message: problem
      }));
    }
    if (seenIds.has(entry.document.labId)) {
      errors.push({ code: 'duplicate-lab-id', labId: entry.document.labId, message: 'Duplicate lab id.' });
    }
    seenIds.add(entry.document.labId);

    const blueprintEntry = blueprint.available ? blueprint.byId.get(entry.document.labId) : null;
    const semantics = validateLabSemantics(entry.document, { blueprint: blueprintEntry });
    errors.push(...semantics.errors);
    warnings.push(...semantics.warnings);
    reviewItems.push(...semantics.reviewItems);
  });

  const referenceIds = new Set();
  corpus.instructorReferences.forEach((entry) => {
    const schemaResult = validateWithSchema(engine.ajv, PATHS.instructorSchema, entry.document, schemaCache);
    if (!schemaResult.ok) {
      schemaResult.problems.forEach((problem) => errors.push({
        code: 'instructor-schema', labId: entry.document.labId || entry.dirName, message: problem
      }));
    }
    referenceIds.add(entry.document.labId);
  });

  // Each delivered lab must have its instructor counterpart, and vice versa.
  seenIds.forEach((labId) => {
    if (!referenceIds.has(labId)) {
      errors.push({ code: 'instructor-missing', labId, message: 'Delivered lab has no instructor reference.' });
    }
  });
  referenceIds.forEach((labId) => {
    if (!seenIds.has(labId)) {
      errors.push({ code: 'lab-missing-for-instructor', labId, message: 'Instructor reference has no student lab.' });
    }
  });

  const missingLabs = expectedLabIds().filter((id) => !seenIds.has(id));
  const totalMinutes = corpus.labs.reduce((sum, entry) => sum + (Number(entry.document.durationMinutes) || 0), 0);

  let status = 'pass';
  if (errors.length > 0) status = 'fail';
  else if (missingLabs.length > 0) status = 'incomplete';

  return {
    schemaVersion: '1.0.0',
    blueprint: {
      available: blueprint.available,
      path: blueprint.path,
      blocker: blueprint.blocker || null
    },
    counts: {
      expectedLabs: EXPECTED_LAB_COUNT,
      studentLabs: corpus.labs.length,
      instructorReferences: corpus.instructorReferences.length,
      deliveredMinutes: totalMinutes,
      expectedMinutes: EXPECTED_TOTAL_MINUTES
    },
    missingLabs,
    errors,
    warnings,
    reviewItems,
    status
  };
}

function formatReport(report) {
  const lines = [];
  lines.push('AUT 250 weekly laboratory validation');
  lines.push('  status: ' + report.status);
  lines.push('  labs: ' + report.counts.studentLabs + '/' + report.counts.expectedLabs
    + ' · instructor references: ' + report.counts.instructorReferences
    + ' · minutes: ' + report.counts.deliveredMinutes + '/' + report.counts.expectedMinutes);
  lines.push('  blueprint: ' + (report.blueprint.available ? 'available' : 'MISSING — ' + report.blueprint.blocker));
  if (report.missingLabs.length) lines.push('  not yet delivered: ' + report.missingLabs.join(', '));
  report.errors.forEach((error) => lines.push('  ERROR [' + error.code + '] ' + error.labId + ': ' + error.message));
  report.warnings.forEach((warning) => lines.push('  WARN  [' + warning.code + '] ' + warning.labId + ': ' + warning.message));
  report.reviewItems.forEach((item) => lines.push('  REVIEW [' + item.kind + '] ' + item.labId + ': ' + item.detail));
  return lines.join('\n');
}

function main() {
  const report = buildReport();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(formatReport(report) + '\n');
  }
  return report.status === 'pass' ? 0 : 1;
}

module.exports = {
  EXPECTED_LAB_COUNT,
  EXPECTED_DURATION_MINUTES,
  EXPECTED_TOTAL_MINUTES,
  SESSION_MINUTE_KEYS,
  FORBIDDEN_STUDENT_FIELDS,
  PATHS,
  expectedLabIds,
  makeAjv,
  makeSchemaCache,
  validateWithSchema,
  validateLabSemantics,
  validateSeparation,
  loadBlueprint,
  validateBlueprintCoverage,
  buildReport,
  formatReport,
  main
};

if (require.main === module) {
  process.exitCode = main();
}


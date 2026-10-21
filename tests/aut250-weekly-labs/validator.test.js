const fs = require('fs');
const path = require('path');
const validator = require('../../scripts/verify-aut250-weekly-labs');
const FIXTURES = path.join(__dirname, 'fixtures');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const validLab = readJson(path.join(FIXTURES, 'valid-lab.json'));

function codes(result) {
  return result.errors.map((error) => error.code);
}

describe('AUT 250 weekly lab validator — fail-closed semantics', () => {
  test('declares the approved 15-week, 120-minute, thirty-hour structure', () => {
    expect(validator.EXPECTED_LAB_COUNT).toBe(15);
    expect(validator.EXPECTED_DURATION_MINUTES).toBe(120);
    expect(validator.EXPECTED_TOTAL_MINUTES).toBe(1800);
    expect(validator.expectedLabIds()).toHaveLength(15);
    expect(validator.expectedLabIds()[0]).toBe('aut250-lab-01');
    expect(validator.expectedLabIds()[14]).toBe('aut250-lab-15');
  });

  test('a conforming lab produces no errors', () => {
    const result = validator.validateLabSemantics(validLab, { blueprint: null });
    expect(result.errors).toEqual([]);
  });

  test('session minutes must total exactly 120', () => {
    const lab = clone(validLab);
    lab.sessionMinutes.debrief = 5;
    expect(codes(validator.validateLabSemantics(lab, {}))).toContain('session-minutes');
  });

  test('lab identity must match the week and the approved id format', () => {
    const lab = clone(validLab);
    lab.week = 2;
    expect(codes(validator.validateLabSemantics(lab, {}))).toContain('lab-id-week');
  });

  test('a declared asset that does not exist on disk is an error', () => {
    const lab = clone(validLab);
    lab.equipment[0].assetRef = 'dashboard/student/aut250-lab-assets/src/does-not-exist.js';
    expect(codes(validator.validateLabSemantics(lab, {}))).toContain('asset-missing');
  });

  test('a real merged asset reference is accepted', () => {
    const lab = clone(validLab);
    lab.equipment[0].assetRef = 'dashboard/student/aut250-lab-assets/src/oscilloscope.js';
    expect(codes(validator.validateLabSemantics(lab, {}))).not.toContain('asset-missing');
  });

  test('illustrative sampled waveforms must be marked illustrative', () => {
    const lab = clone(validLab);
    lab.scenario.waveformEvidence = { mode: 'illustrative_samples', samples: [{ t: 0, v: 1 }], illustrative: false };
    expect(codes(validator.validateLabSemantics(lab, {}))).toContain('waveform-not-marked-illustrative');
  });

  test('any approval flag set true is an error, never tolerated', () => {
    const lab = clone(validLab);
    lab.flags.autoGradingEnabled = true;
    expect(codes(validator.validateLabSemantics(lab, {}))).toContain('flag-not-false');
  });

  test('instructor-only fields in a student bundle are an error', () => {
    const lab = clone(validLab);
    lab.answerKey = 'A';
    expect(codes(validator.validateLabSemantics(lab, {}))).toContain('student-answer-leak');
  });

  test('unverified sources and SME-pending measurements become review items, not approvals', () => {
    const lab = clone(validLab);
    lab.scenario.measurements[0].provenance = 'sme_review_pending';
    const result = validator.validateLabSemantics(lab, {});
    expect(result.errors).toEqual([]);
    expect(result.reviewItems.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['measurement-provenance', 'source-citation', 'source-rights'])
    );
  });

  test('a blueprint title mismatch is an error when a blueprint is supplied', () => {
    const result = validator.validateLabSemantics(validLab, { blueprint: { title: 'Something else' } });
    expect(codes(result)).toContain('blueprint-title');
  });

  test('a missing blueprint is reported as a blocker rather than a silent pass', () => {
    const blueprint = validator.loadBlueprint();
    if (blueprint.available) {
      expect(blueprint.path).toMatch(/aut250-weekly-lab-blueprint\.json$/);
    } else {
      expect(blueprint.blocker).toMatch(/PR #1067 unmerged/);
      expect(blueprint.available).toBe(false);
    }
  });

  test('the live repository corpus reports every undelivered lab instead of passing', () => {
    const report = validator.buildReport();
    expect(['pass', 'incomplete', 'fail']).toContain(report.status);
    expect(report.counts.expectedLabs).toBe(15);
    expect(report.counts.expectedMinutes).toBe(1800);
    if (report.counts.studentLabs < 15) {
      expect(report.status).not.toBe('pass');
      expect(report.missingLabs.length).toBe(15 - report.counts.studentLabs);
    }
    if (!report.blueprint.available) {
      expect(report.blueprint.blocker).toBeTruthy();
    }
  });

  test('the report is deterministic and free of timestamps', () => {
    const first = validator.buildReport();
    const second = validator.buildReport();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toMatch(/generatedAt|timestamp|\d{4}-\d{2}-\d{2}T/);
  });
});

describe('AUT 250 weekly lab validator — schema compilation is cached', () => {
  const STUDENT_SCHEMA = validator.PATHS.studentSchema;

  test('the same schema validates several documents in one run without throwing', () => {
    const engine = validator.makeAjv();
    expect(engine.error).toBeNull();
    const cache = validator.makeSchemaCache();
    const document = { not: 'a lab package' };
    const first = validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, document, cache);
    const second = validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, document, cache);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(false);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
  });

  test('each schema is compiled exactly once per run', () => {
    const engine = validator.makeAjv();
    const cache = validator.makeSchemaCache();
    validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, {}, cache);
    validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, {}, cache);
    validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, {}, cache);
    expect(cache.size).toBe(1);
    expect(typeof cache.get(STUDENT_SCHEMA)).toBe('function');
  });

  test('compiling a freshly read copy of the same schema twice is what the cache prevents', () => {
    // Reproduces the original defect faithfully: validateWithSchema read the
    // schema file on every call, producing a new object with the same $id each
    // time. Ajv caches by object identity, so only a fresh read throws.
    const engine = validator.makeAjv();
    const readFresh = () => JSON.parse(fs.readFileSync(STUDENT_SCHEMA, 'utf8').replace(/^\uFEFF/, ''));
    engine.ajv.compile(readFresh());
    expect(() => engine.ajv.compile(readFresh())).toThrow(/already exists/);
  });

  test('the cached path does not throw when the schema file is re-read', () => {
    const engine = validator.makeAjv();
    const cache = validator.makeSchemaCache();
    expect(() => {
      validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, {}, cache);
      validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, {}, cache);
    }).not.toThrow();
  });

  test('a run without a cache still validates a single document', () => {
    const engine = validator.makeAjv();
    const result = validator.validateWithSchema(engine.ajv, STUDENT_SCHEMA, {}, null);
    expect(result.skipped).toBe(false);
    expect(result.ok).toBe(false);
  });

  test('an unavailable schema engine is reported rather than crashing the run', () => {
    const result = validator.validateWithSchema(null, STUDENT_SCHEMA, {});
    expect(result).toEqual({ ok: true, problems: [], skipped: true });
  });
});

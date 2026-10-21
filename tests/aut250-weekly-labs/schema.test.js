const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_DIR = path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs', 'schema');
const FIXTURES = path.join(__dirname, 'fixtures');

const ajv = new Ajv({ allErrors: true, strict: false });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const studentSchema = readJson(path.join(SCHEMA_DIR, 'student-lab.schema.json'));
const instructorSchema = readJson(path.join(SCHEMA_DIR, 'instructor-reference.schema.json'));
const validateStudent = ajv.compile(studentSchema);
const validateInstructor = ajv.compile(instructorSchema);

const validLab = readJson(path.join(FIXTURES, 'valid-lab.json'));
const validReference = readJson(path.join(FIXTURES, 'valid-instructor-reference.json'));

describe('AUT 250 weekly lab schemas', () => {
  test('both schemas are draft-07 documents with closed objects', () => {
    [studentSchema, instructorSchema].forEach((schema) => {
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.additionalProperties).toBe(false);
      expect(schema.type).toBe('object');
    });
  });

  test('the reference fixture satisfies both schemas', () => {
    expect(validateStudent(validLab)).toBe(true);
    expect(validateInstructor(validReference)).toBe(true);
  });

  test('student schema rejects a wrong duration and a wrong competency', () => {
    const shortLab = clone(validLab);
    shortLab.durationMinutes = 90;
    expect(validateStudent(shortLab)).toBe(false);

    const wrongCompetency = clone(validLab);
    wrongCompetency.competencyId = 'ug-something-else';
    expect(validateStudent(wrongCompetency)).toBe(false);
  });

  test('student schema rejects any approval, grading, or publication flag set true', () => {
    ['assessmentEligible', 'autoGradingEnabled', 'published', 'smeApproved', 'rightsApproved'].forEach((flag) => {
      const lab = clone(validLab);
      lab.flags[flag] = true;
      expect(validateStudent(lab)).toBe(false);
    });
  });

  test('student schema rejects instructor-only answer fields', () => {
    ['expectedAnswer', 'answerKey', 'correctAnswer', 'expectedEvidence', 'misconceptionFeedback']
      .forEach((field) => {
        const lab = clone(validLab);
        lab[field] = 'leaked';
        expect(validateStudent(lab)).toBe(false);
      });
  });

  test('student schema requires at least two competing hypotheses', () => {
    const lab = clone(validLab);
    lab.competingHypotheses = [lab.competingHypotheses[0]];
    expect(validateStudent(lab)).toBe(false);
  });

  test('student schema rejects an out-of-range lab id or week', () => {
    const badId = clone(validLab);
    badId.labId = 'aut250-lab-16';
    expect(validateStudent(badId)).toBe(false);

    const badWeek = clone(validLab);
    badWeek.week = 16;
    expect(validateStudent(badWeek)).toBe(false);
  });

  test('student schema rejects an unknown measurement provenance', () => {
    const lab = clone(validLab);
    lab.scenario.measurements[0].provenance = 'manufacturer_verified';
    expect(validateStudent(lab)).toBe(false);
  });

  test('student schema accepts every week 1-15 identity and totals thirty hours', () => {
    let minutes = 0;
    for (let week = 1; week <= 15; week += 1) {
      const lab = clone(validLab);
      lab.week = week;
      lab.labId = 'aut250-lab-' + String(week).padStart(2, '0');
      expect(validateStudent(lab)).toBe(true);
      minutes += lab.durationMinutes;
    }
    expect(minutes).toBe(1800);
  });

  test('instructor schema requires instructorOnly true and fail-closed flags', () => {
    const notInstructor = clone(validReference);
    notInstructor.instructorOnly = false;
    expect(validateInstructor(notInstructor)).toBe(false);

    const flagged = clone(validReference);
    flagged.flags.published = true;
    expect(validateInstructor(flagged)).toBe(false);
  });
});

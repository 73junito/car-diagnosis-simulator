const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const validator = require('../../scripts/verify-aut250-weekly-labs');

const ROOT = path.resolve(__dirname, '..', '..');
const WL = path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs');
const INSTRUCTOR = path.join(ROOT, 'instructor-resources', 'aut250-weekly-labs');
const WEEKS = [1, 2, 3, 4];

const ajv = new Ajv({ allErrors: true, strict: false });
const studentSchema = JSON.parse(fs.readFileSync(path.join(WL, 'schema', 'student-lab.schema.json'), 'utf8'));
const instructorSchema = JSON.parse(fs.readFileSync(path.join(WL, 'schema', 'instructor-reference.schema.json'), 'utf8'));
const validateStudent = ajv.compile(studentSchema);
const validateInstructor = ajv.compile(instructorSchema);

function labId(week) {
  return 'aut250-lab-' + String(week).padStart(2, '0');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function lab(week) {
  return readJson(path.join(WL, 'labs', labId(week), 'lab.json'));
}

function reference(week) {
  return readJson(path.join(INSTRUCTOR, labId(week), 'reference.json'));
}

describe('AUT 250 Weeks 1-4 — student lab packages', () => {
  test('all four student packages are schema-valid', () => {
    WEEKS.forEach((week) => {
      const document = lab(week);
      const valid = validateStudent(document);
      if (!valid) throw new Error(labId(week) + ': ' + JSON.stringify(validateStudent.errors));
      expect(valid).toBe(true);
    });
  });

  test('identifiers, weeks, titles and durations match the frozen blueprint plan', () => {
    const expectedTitles = {
      1: 'Diagnostic safety and equipment familiarization',
      2: 'Concern verification and diagnostic strategy',
      3: 'Ford and GM OBD-I interpretation',
      4: 'OBD-II DTC and freeze-frame interpretation'
    };
    WEEKS.forEach((week) => {
      const document = lab(week);
      expect(document.labId).toBe(labId(week));
      expect(document.week).toBe(week);
      expect(document.title).toBe(expectedTitles[week]);
      expect(document.durationMinutes).toBe(120);
      expect(document.competencyId).toBe('ug-aut250-systematic-diagnostics');
    });
  });

  test('every lab keeps the 10/15/60/25/10 allocation totalling 120 minutes', () => {
    WEEKS.forEach((week) => {
      const minutes = lab(week).sessionMinutes;
      expect(minutes).toEqual({
        safetyBriefing: 10,
        instructorDemonstration: 15,
        studentDiagnosis: 60,
        evidenceReport: 25,
        debrief: 10
      });
      expect(Object.values(minutes).reduce((a, b) => a + b, 0)).toBe(120);
    });
  });

  test('all five approval and publication flags remain false in every package', () => {
    WEEKS.forEach((week) => {
      const flags = lab(week).flags;
      Object.keys(flags).forEach((flag) => expect(flags[flag]).toBe(false));
    });
  });

  test('semantic validation reports no errors for any delivered lab', () => {
    WEEKS.forEach((week) => {
      const result = validator.validateLabSemantics(lab(week), { blueprint: null });
      if (result.errors.length) throw new Error(labId(week) + ': ' + JSON.stringify(result.errors));
      expect(result.errors).toEqual([]);
    });
  });

  test('every blueprint equipment id for Weeks 1-4 is mapped to a real status', () => {
    const expected = {
      1: ['dvom', 'scan_tool', 'oscilloscope'],
      2: ['work_order', 'service_information'],
      3: ['legacy_code_reference', 'vehicle_profile'],
      4: ['scan_tool', 'freeze_frame']
    };
    WEEKS.forEach((week) => {
      expect(lab(week).equipment.map((item) => item.id).sort()).toEqual(expected[week].slice().sort());
      lab(week).equipment.forEach((item) => {
        expect(['available', 'prototype', 'missing']).toContain(item.availability);
        expect(typeof item.notes).toBe('string');
        expect(item.notes.length).toBeGreaterThan(20);
      });
    });
  });

  test('every declared asset reference resolves to a real file', () => {
    WEEKS.forEach((week) => {
      lab(week).equipment.forEach((item) => {
        if (!item.assetRef) return;
        expect(fs.existsSync(path.join(ROOT, item.assetRef))).toBe(true);
      });
    });
  });

  test('unavailable equipment is disclosed rather than simulated', () => {
    const missing = lab(2).equipment.find((item) => item.id === 'service_information');
    expect(missing.availability).toBe('missing');
    expect(missing.assetRef).toBeNull();
    expect(missing.notes).toMatch(/Not available/);
  });

  test('stand-ins are labelled developmental and never described as completed tools', () => {
    [lab(2), lab(3)].forEach((document) => {
      document.equipment
        .filter((item) => item.availability === 'prototype')
        .forEach((item) => {
          expect(item.notes).toMatch(/stand-in|Minimal original/i);
          expect(item.notes).toMatch(/not a completed/i);
        });
    });
  });
});

describe('AUT 250 Weeks 1-4 — technical accuracy guards', () => {
  test('no package asserts a manufacturer code definition or OEM limit', () => {
    WEEKS.forEach((week) => {
      const text = JSON.stringify(lab(week));
      // An asserted OEM limit would pair the term with a value. A negation such
      // as "no OEM limit is stated" is not an assertion and is allowed.
      expect(text).not.toMatch(/OEM[^.]{0,60}\d/i);
      expect(text).not.toMatch(/\bin-?spec\b|\bout-of-spec\b/i);
      expect(text).not.toMatch(/\b[PBCU]\d{4}\b/);
    });
  });

  test('no sampled waveform is supplied and none is implied', () => {
    WEEKS.forEach((week) => {
      const waveform = lab(week).scenario.waveformEvidence;
      expect(waveform.mode).toBe('qualitative');
      expect(waveform.samples).toBeNull();
      expect(waveform.illustrative).toBe(true);
    });
  });

  test('every reading carries conditions, provenance and limitations', () => {
    WEEKS.forEach((week) => {
      lab(week).scenario.measurements.forEach((measurement) => {
        expect(typeof measurement.conditions).toBe('string');
        expect(measurement.conditions.length).toBeGreaterThan(3);
        expect(['supplied_simulation', 'illustrative', 'sme_review_pending']).toContain(measurement.provenance);
        expect(typeof measurement.limitations).toBe('string');
      });
    });
  });

  test('every lab supplies at least two competing hypotheses and two test options', () => {
    WEEKS.forEach((week) => {
      expect(lab(week).competingHypotheses.length).toBeGreaterThanOrEqual(2);
      expect(lab(week).testSelectionOptions.length).toBeGreaterThanOrEqual(2);
      expect(lab(week).evidenceWorksheet.prompts.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('OBD-I and OBD-II weeks require context and mark code meaning as unresolved', () => {
    expect(lab(3).scenario.vehicleContext.contextStatus).toBe('specified');
    expect(lab(3).scenario.vehicleContext.testMode).toBeTruthy();
    expect(JSON.stringify(lab(3))).toMatch(/source_review_pending/);
    expect(lab(4).scenario.vehicleContext.contextStatus).toBe('unknown');
    expect(JSON.stringify(lab(4))).toMatch(/not a real diagnostic trouble code/i);
  });

  test('no lab treats a stored code as proof that a component failed', () => {
    const text = JSON.stringify(lab(4));
    expect(text).toMatch(/not identify a failed component|does not by itself prove|not proof/i);
  });
});

describe('AUT 250 Weeks 1-4 — instructor references and separation', () => {
  test('all four instructor references are schema-valid and marked instructor-only', () => {
    WEEKS.forEach((week) => {
      const document = reference(week);
      const valid = validateInstructor(document);
      if (!valid) throw new Error(labId(week) + ': ' + JSON.stringify(validateInstructor.errors));
      expect(document.instructorOnly).toBe(true);
      expect(document.labId).toBe(labId(week));
      expect(document.week).toBe(week);
    });
  });

  test('instructor references carry expected evidence, alternatives and misconception feedback', () => {
    WEEKS.forEach((week) => {
      const document = reference(week);
      expect(document.expectedEvidence.length).toBeGreaterThanOrEqual(3);
      expect(document.acceptableAlternatives.length).toBeGreaterThanOrEqual(1);
      expect(document.misconceptionFeedback.length).toBeGreaterThanOrEqual(2);
      expect(document.debriefPrompts.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('no instructor reference lives inside the student tree', () => {
    const offenders = [];
    const walk = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'reference.json') offenders.push(full);
      });
    };
    walk(path.join(WL, 'labs'));
    expect(offenders).toEqual([]);
  });

  test('student bundles contain no instructor-only top-level fields', () => {
    const INSTRUCTOR_ONLY = [
      'instructorOnly', 'expectedEvidence', 'acceptableAlternatives',
      'misconceptionFeedback', 'debriefPrompts'
    ];
    WEEKS.forEach((week) => {
      const document = lab(week);
      INSTRUCTOR_ONLY.forEach((key) => {
        expect(Object.prototype.hasOwnProperty.call(document, key)).toBe(false);
      });
      // The validator applies the same rule independently of this test.
      validator.FORBIDDEN_STUDENT_FIELDS.forEach((field) => {
        expect(Object.prototype.hasOwnProperty.call(document, field)).toBe(false);
      });
    });
  });

  test('the student and instructor artifacts declare disjoint top-level shapes', () => {
    WEEKS.forEach((week) => {
      const studentKeys = Object.keys(lab(week));
      const instructorKeys = Object.keys(reference(week));
      expect(studentKeys).not.toContain('instructorOnly');
      expect(instructorKeys).toContain('instructorOnly');
      expect(instructorKeys.filter((key) => studentKeys.includes(key)).sort())
        .toEqual(['flags', 'labId', 'schemaVersion', 'sources', 'technicalReviewChecklist', 'week']);
    });
  });

  test('instructor content is never referenced from the student lab pages', () => {
    WEEKS.forEach((week) => {
      const page = fs.readFileSync(path.join(WL, 'labs', labId(week), 'index.html'), 'utf8');
      expect(page).not.toMatch(/instructor-resources|reference\.json/i);
    });
  });
});

describe('AUT 250 Weeks 1-4 — validator reports partial progress honestly', () => {
  test('the validator never reports pass while labs are undelivered', () => {
    const report = validator.buildReport();
    expect(report.counts.studentLabs).toBe(4);
    expect(report.status).toBe('incomplete');
    expect(report.status).not.toBe('pass');
    expect(report.missingLabs).toHaveLength(11);
    expect(report.missingLabs[0]).toBe('aut250-lab-05');
  });

  test('no errors are reported for the four delivered labs', () => {
    const report = validator.buildReport();
    const labErrors = report.errors.filter((error) => /^aut250-lab-0[1-4]$/.test(error.labId));
    if (labErrors.length) throw new Error(JSON.stringify(labErrors));
    expect(labErrors).toEqual([]);
  });

  test('the blueprint gap is reported as a blocker rather than assumed satisfied', () => {
    const report = validator.buildReport();
    if (report.blueprint.available) {
      expect(report.blueprint.blocker).toBeNull();
      expect(report.errors.filter((error) => String(error.code).startsWith('blueprint-'))).toEqual([]);
    } else {
      expect(report.blueprint.blocker).toMatch(/PR #1067/);
    }
  });

  test('pending source and rights items are surfaced for human review', () => {
    const report = validator.buildReport();
    const kinds = report.reviewItems.map((item) => item.kind);
    expect(kinds).toContain('source-citation');
    expect(kinds).toContain('source-rights');
  });
});


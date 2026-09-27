const fs = require('fs');
const path = require('path');

describe('AUT-250 independently authored course modules', () => {
  const curriculum = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'curriculum', 'lesson-content.json'), 'utf8')
  );
  const aut250 = curriculum.lessonContentPlans.find((plan) => plan.lessonPlanId === 'ug-hev-foundations');

  test('defines six ordered follow-on modules', () => {
    expect(aut250).toBeTruthy();
    expect(aut250.courseModules).toHaveLength(6);
    expect(aut250.courseModules.map((module) => module.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(aut250.courseModuleSequence).toEqual(aut250.courseModules.map((module) => module.id));
  });

  test('keeps every module independently authored and instructionally complete', () => {
    for (const module of aut250.courseModules) {
      expect(module.authorship).toBe('project-authored');
      expect(module.moduleObjectives.length).toBeGreaterThanOrEqual(4);
      expect(module.lessons.length).toBeGreaterThanOrEqual(3);
      expect(module.practice.length).toBeGreaterThanOrEqual(3);
      expect(module.assessments.length).toBeGreaterThanOrEqual(4);
      expect(module.visuals.length).toBeGreaterThanOrEqual(3);
      expect(module.safetyAndEvidenceBoundary).toEqual(expect.any(String));
      expect(module.safetyAndEvidenceBoundary.length).toBeGreaterThan(40);

      for (const lesson of module.lessons) {
        expect(lesson.text).toEqual(expect.any(String));
        expect(lesson.text.length).toBeGreaterThan(180);
        expect(lesson.learnerAction).toEqual(expect.any(String));
        expect(lesson.evidenceBoundary).toEqual(expect.any(String));
      }
    }
  });

  test('preserves the original-expression and vehicle-specific evidence boundaries', () => {
    expect(aut250.authorship.frameworkReferencePolicy)
      .toBe('framework-reference-only / original-expression-required');
    expect(aut250.rightsBoundary).toMatch(/independently authored AutoLearnPro content/i);
    expect(aut250.evidenceExpectation).toMatch(/vehicle|component context/i);
    expect(aut250.assessmentBoundary).toMatch(/separate approval state/i);
  });

  test('covers the approved AUT-250 follow-on subject areas', () => {
    const titles = aut250.courseModules.map((module) => module.title).join(' ');
    expect(titles).toMatch(/Battery Systems/i);
    expect(titles).toMatch(/Power Electronics/i);
    expect(titles).toMatch(/Charging Systems/i);
    expect(titles).toMatch(/Thermal Management/i);
    expect(titles).toMatch(/Low-Voltage Dependencies/i);
    expect(titles).toMatch(/Advanced Diagnostic Reasoning/i);
  });
});

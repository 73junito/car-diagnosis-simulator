const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('AUT-250 learner course dashboard', () => {
  const html = read('exam-site/courses/aut-250/index.html');
  const js = read('exam-site/courses/aut-250/course.js');

  test('creates a dedicated learner route with curriculum escape hatch', () => {
    expect(html).toContain('AUT-250 · LEARNER COURSE');
    expect(html).toContain('Six-module learning path');
    expect(html).toContain('/lesson-plans/#ug-hev-foundations');
    expect(html).toContain('data-course-release-status');
    expect(html).toContain('data-module-grid');
  });

  test('fails closed unless every final training approval boundary remains true', () => {
    expect(js).toContain('decision?.decision === "approved"');
    expect(js).toContain('decision?.scope === "training-bank-final-approval-only"');
    expect(js).toContain('effect?.scored === false');
    expect(js).toContain('effect?.high_stakes_eligible === false');
    expect(js).toContain('effect?.institutional_assessment_eligible === false');
    expect(js).toContain('effect?.production_assessment_api_eligible === false');
    expect(js).toContain('release?.production_release === false');
    expect(js).toContain('release?.assessment_release === false');
    expect(js).toContain('release?.high_stakes_release === false');
    expect(js).toContain('dataset.aut250CourseRelease = "blocked"');
  });

  test('requires six modules, both approvals, and the 40-question combined training bank', () => {
    expect(js).toContain('modules.length !== 6');
    expect(js).toContain('BATCH002_APPROVAL_URL');
    expect(js).toContain('BATCH002_CURRICULUM_URL');
    expect(js).toContain('mergeBatch002IntoPlan');
    expect(js).toContain('[8, 8, 6, 6, 6, 6]');
    expect(js).toContain('length !== 40');
  });

  test('stores completion only in this browser', () => {
    expect(js).toContain('localStorage.getItem(STORAGE_KEY)');
    expect(js).toContain('localStorage.setItem(STORAGE_KEY');
    expect(js).toContain('progress stored only in this browser');
  });
});

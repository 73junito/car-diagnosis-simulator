const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('AUT-250 evidence instructor drawer', () => {
  const html = read('exam-site/courses/aut-250/module/index.html');
  const js = read('exam-site/courses/aut-250/module/module.js');

  test('keeps evidence details in a progressive-disclosure drawer', () => {
    expect(html).toContain('data-evidence-drawer-open hidden');
    expect(html).toContain('data-evidence-drawer');
    expect(html).toContain('INSTRUCTOR / EVIDENCE VIEW');
    expect(js).toContain('initEvidenceDrawer(approval, module)');
    expect(js).toContain('openButton.hidden = false');
  });

  test('shows governance facts without claiming rights or excerpt validation', () => {
    expect(js).toContain('citation_representation');
    expect(js).toContain('deterministic_metadata_validation');
    expect(js).toContain('human_reviews_complete');
    expect(js).toContain('Metadata-only citation validation does not claim excerpt verification');
    expect(js).toContain('source-rights clearance');
    expect(js).toContain('Approved for training use');
    expect(js).toContain('Metadata-only citation proof');
    expect(js).toContain('(prereq.required_human_roles || []).length');
    expect(js).toContain('Current release authority comes from the final AUT-250 approval credential');
  });

  test('surfaces module safety boundary and question metadata only', () => {
    expect(js).toContain('module.safetyAndEvidenceBoundary');
    expect(js).toContain('id: question.id');
    expect(js).toContain('topic: question.topic');
    expect(js).toContain('authorship: question.authorship');
    expect(js).toContain('deliveryMode: question.deliveryMode');
    expect(js).toContain('Answer keys are intentionally not shown');
  });

  test('does not add answer key to drawer metadata model', () => {
    const start = js.indexOf('function renderEvidenceDrawer');
    const end = js.indexOf('function initEvidenceDrawer');
    const drawerFunction = js.slice(start, end);
    expect(drawerFunction).not.toContain('answer: question.answer');
    expect(drawerFunction).not.toContain('question.answer');
  });

  test('preserves production assessment ineligibility', () => {
    expect(js).toContain('effect.production_assessment_api_eligible === false');
    expect(html).toContain('not eligible for institutional or high-stakes assessment');
  });
});

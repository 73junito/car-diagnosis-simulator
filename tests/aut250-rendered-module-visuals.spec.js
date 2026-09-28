const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

describe('AUT-250 learner-rendered module visuals', () => {
  const renderer = read('exam-site/courses/aut-250/module/module-visuals.js');
  const player = read('exam-site/courses/aut-250/module/module.js');
  const html = read('exam-site/courses/aut-250/module/index.html');
  const curriculum = json('data/curriculum/lesson-content.json');
  const plan = curriculum.lessonContentPlans.find((item) => item.lessonPlanId === 'ug-hev-foundations');
  const visuals = plan.courseModules.flatMap((module) => module.visuals || []);

  test('models every existing AUT-250 planned visual without external figure reuse', () => {
    expect(visuals).toHaveLength(18);
    for (const visual of visuals) {
      expect(renderer).toContain(JSON.stringify(visual.title));
    }
    expect(renderer).not.toMatch(/<img|https?:\/\//i);
  });

  test('supports the approved visual categories used by AUT-250', () => {
    expect(renderer).toContain('kind:"nodes"');
    expect(renderer).toContain('kind:"steps"');
    expect(renderer).toContain('kind:"table"');
    expect(renderer).toContain('kind:"timeline"');
    expect(renderer).toContain('kind:"cycle"');
  });

  test('renders project-authored visuals before the question player', () => {
    expect(player).toContain('renderModuleVisuals');
    expect(player).toContain('setModuleVisualReasoningStep');
    expect(player).toContain('visualGrid.innerHTML = renderModuleVisuals(module.visuals || [])');
    expect(html.indexOf('data-visual-section')).toBeLessThan(html.indexOf('data-question-player'));
    expect(html).toContain('Project-authored instructional graphics');
    expect(html).toContain('Vehicle-specific procedures, values, and service boundaries');
  });
});

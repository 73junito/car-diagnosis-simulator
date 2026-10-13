const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('shared shell accessibility and runtime hardening', () => {
  test('shared shell presents AutoLearnPro with role-aware navigation', () => {
    const shell = read('theme/shell.js');
    const navigation = read('theme/navigation.js');

    expect(shell).toContain('AutoLearnPro');
    expect(shell).not.toContain('<div class="tm-brand">TorqueMind</div>');
    expect(shell).toContain('tm-skip-link');
    expect(shell).toContain('workspaceNavFor');
    expect(navigation).toContain("student: Object.freeze");
    expect(navigation).toContain("instructor: Object.freeze");
    expect(navigation).toContain("institution: Object.freeze");
    expect(navigation).toContain("author: Object.freeze");
    expect(navigation).toContain("'/reference-library/'");
  });

  test('shared layout provides keyboard, reduced-motion, and mobile safeguards', () => {
    const css = read('theme/layout.css');
    expect(css).toContain('.tm-skip-link');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('student styling no longer pads the entire document around the shared shell', () => {
    const css = read('dashboard/student/student.css');
    expect(css).toContain('margin:0;padding:0');
    expect(css).not.toContain('margin:0;padding:24px');
  });

  test('async student tools expose busy states and lock duplicate actions', () => {
    const reference = read('reference-library/library.js');
    const coach = read('dashboard/student/coach/coach.js');
    const activity = read('dashboard/student/activity/activity.js');
    const copilot = read('dashboard/student/copilot/copilot.js');

    for (const source of [reference, coach, activity, copilot]) {
      expect(source).toContain('aria-busy');
    }
    expect(reference).toContain('clearButton.disabled=true');
    expect(coach).toContain('refresh.disabled=true');
    expect(activity).toContain('refresh.disabled=true');
    expect(copilot).toContain('healthRefresh.disabled=true');
    expect(copilot).toContain('submitButton.disabled=true');
  });

  test('production smoke includes the hardened live routes', () => {
    const smoke = read('scripts/verify-production-surfaces.js');
    expect(smoke).toContain("'/reference-library/'");
    expect(smoke).toContain("'/dashboard/student/coach/'");
    expect(smoke).toContain("'/dashboard/student/copilot/'");
    expect(smoke).toContain("'/research-sources/'");
  });
});

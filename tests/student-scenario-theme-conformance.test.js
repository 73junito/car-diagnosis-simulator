/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const html = fs.readFileSync(
  path.resolve('dashboard/student/scenario/index.html'),
  'utf8'
)
const css = fs.readFileSync(
  path.resolve('dashboard/student/scenario/scenario.css'),
  'utf8'
)
const js = fs.readFileSync(
  path.resolve('dashboard/student/scenario/scenario.js'),
  'utf8'
)

describe('Student Scenario theme conformance', () => {
  test('loads the canonical shared AutoLearnPro theme layers', () => {
    // Shared theme stack (same as Student Dashboard / Reference Library).
    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')

    // Legacy isolated presentation is gone.
    expect(html).not.toContain('href="../student.css"')
    expect(css).not.toMatch(/font-family:\s*Arial/i)
    expect(css).not.toMatch(/background:\s*#050b14/i)
  })

  test('mounts the shared AutoLearnPro shell and student navigation', () => {
    expect(html).toContain('<div data-theme-shell></div>')
    expect(html).toContain('import { mountShell } from "/theme/shell.js"')
    expect(html).toContain('mountShell()')
  })

  test('uses the shared main landmark and content width', () => {
    expect(html).toContain('<main class="tm-main wrapper">')
  })

  test('preserves the scenario render target and functional selectors', () => {
    // The JS render target must remain present and queryable.
    expect(html).toContain('id="scenarioPage"')
    // Functional anchors scenario.js depends on.
    expect(js).toContain('getElementById("scenarioPage")')
    expect(js).toContain('querySelector("#attemptSummary")')
    // Scenario data + behavior scripts are still wired.
    expect(html).toContain('src="/data/scenario-registry.js"')
    expect(html).toContain('src="./scenario.js"')
  })

  test('keeps the load-bearing scenario classes used by scenario.js', () => {
    // These class names are emitted by scenario.js and must not be renamed.
    for (const cls of [
      'scenario-hero',
      'scenario-label',
      'scenario-card',
      'reasoning-sequence',
      'reasoning-steps',
      'question-option',
      'torquemind-feedback',
      'answer-feedback',
    ]) {
      expect(js).toContain(cls)
      expect(css).toContain('.' + cls)
    }
  })

  test('restyles onto shared tokens rather than a legacy palette', () => {
    // Scenario content now sources colors/spacing/radius from shared tokens.
    expect(css).toContain('var(--tm-primary)')
    expect(css).toContain('var(--tm-surface)')
    expect(css).toContain('var(--tm-border)')
    expect(css).toContain('var(--tm-radius)')
  })

  test('introduces no retired third-party certification trademark or taxonomy', () => {
    const combined = `${html}\n${css}\n${js}`
    // Protected third-party automotive certification mark / spelled-out org.
    expect(combined).not.toMatch(/\bASE\b/)
    expect(combined.toLowerCase()).not.toContain('automotive service excellence')
    // A1-A8 / L1 / L3 certification-area taxonomy labels.
    expect(combined).not.toMatch(/\bA[1-8]\b/)
    expect(combined).not.toMatch(/\bL1\b/)
    expect(combined).not.toMatch(/\bL3\b/)
    // No certification/affiliation claims.
    expect(combined.toLowerCase()).not.toContain('certified technician')
    expect(combined.toLowerCase()).not.toContain('ase-certified')
  })
})

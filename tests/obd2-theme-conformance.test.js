/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8')

const pages = [
  {
    html: 'dashboard/obd2.html',
    css: 'dashboard/obd2.css',
    js: 'dashboard/obd2.js',
    pageScript: 'src="/dashboard/obd2.js"',
    entryPoint: 'window.initObd2Dashboard',
    requiredIds: [
      'gauge-rpm',
      'gauge-speed',
      'gauge-coolant',
      'gauge-voltage',
      'scenario-select',
      'dtc-list',
      'dtc-detail-code',
      'dtc-detail-desc',
      'live-start',
      'live-stop',
      'live-list',
      'freeze-list',
      'freeze-detail-title',
      'freeze-desc',
    ],
    requiredClasses: ['.gauge', '.g-value', '.g-fill', '.dtc-list', '.live-list', '.freeze-list'],
  },
  {
    html: 'dashboard/obd2-student.html',
    css: 'dashboard/obd2-student.css',
    js: 'dashboard/obd2-student.js',
    pageScript: 'src="/dashboard/obd2-student.js"',
    entryPoint: 'initObd2StudentWorkflow',
    requiredIds: [
      'scenario-select',
      'symptom-text',
      'test-checklist',
      'diagnosis-input',
      'submit-diagnosis',
      'diagnosis-feedback',
      'score-summary',
      'score-value',
      'score-breakdown',
      'score-state',
    ],
    requiredClasses: ['.test-checklist', '.feedback', '.score-summary'],
  },
  {
    html: 'dashboard/obd2-procedural.html',
    css: 'dashboard/obd2-procedural.css',
    js: 'dashboard/obd2-procedural.js',
    pageScript: 'src="/dashboard/obd2-procedural.js"',
    entryPoint: 'initProceduralAssessment',
    requiredIds: [
      'procedural-scenario-select',
      'procedural-step-list',
      'procedural-safety-label',
      'procedural-safety-ack',
      'procedural-check-complete',
      'procedural-completion-state',
    ],
    requiredClasses: ['.procedural-step-list', '.hidden', '#procedural-completion-state'],
  },
]

describe('OBD-II shared AutoLearnPro theme conformance', () => {
  test.each(pages)('$html loads the canonical shared theme layers', (page) => {
    const html = read(page.html)

    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain(`href="/${page.css}"`)

    // Shared stack must load before the page stylesheet so page rules layer last.
    expect(html.indexOf('/theme/tokens.css')).toBeLessThan(html.indexOf(page.css))
    expect(html.indexOf('/theme/dashboard.css')).toBeLessThan(html.indexOf(page.css))
  })

  test.each(pages)('$html mounts the shared AutoLearnPro shell', (page) => {
    const html = read(page.html)

    expect(html).toContain('<div data-theme-shell></div>')
    expect(html).toContain('import { mountShell } from "/theme/shell.js"')
    expect(html).toContain('mountShell()')
    expect(html).toContain('tm-main wrapper')
    expect(html).toContain('href="/dashboard/student/"')
  })

  test.each(pages)('$html preserves the load-bearing ids and scripts', (page) => {
    const html = read(page.html)

    for (const id of page.requiredIds) {
      expect(html).toContain(`id="${id}"`)
    }
    // The page behavior script stays wired exactly as before.
    expect(html).toContain(page.pageScript)
  })

  test.each(pages)('$js entry points and behavior remain intact', (page) => {
    const js = read(page.js)
    expect(js).toContain(page.entryPoint)
  })

  test('student workflow keeps the explicit accessibility label contract', () => {
    const html = read('dashboard/obd2-student.html')
    expect(html).toContain('<label for="symptom-text">Observed symptoms</label>')
    expect(html).toContain('<textarea id="symptom-text"')
    expect(html).toContain('<label for="diagnosis-input">Your diagnosis</label>')
    expect(html).toContain('<input id="diagnosis-input"')
    // Scenario data scripts the workflow depends on stay wired.
    expect(html).toContain('src="/data/scenarios.js"')
    expect(html).toContain('src="/data/scenario-content-map.js"')
    expect(html).toContain('src="/data/scenario-registry.js"')
  })
  test.each(pages)('$css restyles onto shared tokens rather than a legacy palette', (page) => {
    const css = read(page.css)

    expect(css).toContain('var(--tm-primary)')
    expect(css).toContain('var(--tm-surface)')
    expect(css).toContain('var(--tm-border)')
    // Matches the shared radius scale (--tm-radius, -sm, -lg).
    expect(css).toContain('var(--tm-radius')

    // Legacy isolated presentation is gone.
    expect(css).not.toMatch(/font-family:\s*Arial/i)
    expect(css).not.toContain('#1976d2')
    expect(css).not.toContain('#4caf50')
    expect(css).not.toContain('#f44336')
    expect(css).not.toContain('#e8f5e9')
    expect(css).not.toContain('#ffebee')

    // Responsive behavior at the required widths.
    expect(css).toContain('@media (max-width')

    // Classes emitted by the page JS remain styled (never renamed away).
    for (const cls of page.requiredClasses) {
      expect(css).toContain(cls)
    }
  })

  test('introduces no retired third-party certification trademark or taxonomy', () => {
    const combined = pages
      .map((page) => `${read(page.html)}\n${read(page.css)}\n${read(page.js)}`)
      .join('\n')
    // Prohibited strings are constructed dynamically: the project-wide
    // Trademark Policy Guard scans all active source (including tests),
    // so this file must not carry the protected tokens as literals.
    const protectedMark = ['A', 'S', 'E'].join('')
    const organizationName = ['automotive', 'service', 'excellence'].join(' ')
    const certificationClaim = [protectedMark.toLowerCase(), 'certified'].join('-')
    const certifiedTechnician = ['certified', 'technician'].join(' ')
    // Protected third-party automotive certification mark / spelled-out org.
    expect(combined).not.toMatch(new RegExp('\\b' + protectedMark + '\\b'))
    expect(combined.toLowerCase()).not.toContain(organizationName)
    // Certification-area taxonomy labels.
    expect(combined).not.toMatch(/\bA[1-8]\b/)
    expect(combined).not.toMatch(/\bL1\b/)
    expect(combined).not.toMatch(/\bL3\b/)
    // No certification/affiliation claims.
    expect(combined.toLowerCase()).not.toContain(certifiedTechnician)
    expect(combined.toLowerCase()).not.toContain(certificationClaim)
  })
})

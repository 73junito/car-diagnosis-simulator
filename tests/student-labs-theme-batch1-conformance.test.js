/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8')

const pages = [
  {
    html: 'dashboard/student/circuit-lab/index.html',
    css: 'dashboard/student/circuit-lab/circuit-lab.css',
    js: 'dashboard/student/circuit-lab/circuit-lab.js',
    pageScript: 'src="./circuit-lab.js"',
    requiredIds: [
      'voltageProfile',
      'stateSelect',
      'faultSelect',
      'showSystemFlow',
      'tracePower',
      'traceGround',
      'resetView',
      'stateBadge',
      'circuitSvg',
      'flowNote',
      'inspectorContent',
      'guidedSteps',
      'chargingEngineeringHeading',
      'chargingEngineeringStatus',
      'chargingComparisonSummary',
    ],
    requiredClasses: ['.wire', '.component', '.test-point', '.voltage-chip'],
  },
  {
    html: 'dashboard/student/starting-system-lab/index.html',
    css: 'dashboard/student/starting-system-lab/starting-system-lab.css',
    js: 'dashboard/student/starting-system-lab/starting-system-lab.js',
    pageScript: 'src="./starting-system-lab.js"',
    requiredIds: [
      'voltageProfile',
      'stateSelect',
      'faultSelect',
      'showSystemFlow',
      'traceControl',
      'tracePower',
      'traceGround',
      'resetView',
      'stateBadge',
      'circuitSvg',
      'flowNote',
      'inspectorContent',
      'guidedSteps',
      'startingEngineeringHeading',
      'startingEngineeringStatus',
      'startingComparisonSummary',
      'startingAnimationPlayer',
      'startingLegacyVisualization',
    ],
    requiredClasses: ['.starting-system-note'],
    layeredClasses: ['.wire', '.component', '.test-point'],
  },
]

describe('Student labs shared-theme conformance (Batch 1: circuit + starting-system)', () => {
  test.each(pages)('$html loads the canonical shared theme layers', (page) => {
    const html = read(page.html)

    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain(page.css.split('/').pop())

    // Legacy isolated student palette is gone.
    expect(html).not.toContain('href="../student.css"')
  })

  test.each(pages)('$html mounts the shared AutoLearnPro shell', (page) => {
    const html = read(page.html)

    expect(html).toContain('<div data-theme-shell></div>')
    expect(html).toContain('import { mountShell } from "/theme/shell.js"')
    expect(html).toContain('mountShell()')
    expect(html).toContain('class="lab-shell tm-main"')
    expect(html).toContain('href="/dashboard/student/"')
    expect(html).toContain('AutoLearnPro')
  })

  test.each(pages)('$html preserves the load-bearing ids and scripts', (page) => {
    const html = read(page.html)

    for (const id of page.requiredIds) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain(page.pageScript)
  })

  test('starting-system page keeps the shared engineering stylesheet layered', () => {
    const html = read('dashboard/student/starting-system-lab/index.html')
    expect(html).toContain('href="/dashboard/student/circuit-lab/circuit-lab.css"')
    expect(html).toContain('href="./starting-system-lab.css"')
  })
  test('circuit JS entry points and behavior remain intact', () => {
    const js = read('dashboard/student/circuit-lab/circuit-lab.js')
    expect(js).toContain('generic-charging-system.json')
  })

  test('starting-system JS keeps the canonical engineering model ids', () => {
    const js = read('dashboard/student/starting-system-lab/starting-system-lab.js')
    const runtime = JSON.parse(read('data/architecture/starting-system-lmf-runtime.json'))
    for (const id of ['BAT1', 'FUSE1', 'SW1', 'SOL_COIL', 'SOL_CONTACT', 'MTR1', 'GND1']) {
      expect(js).toContain(id)
    }
    expect(js).toContain('starting-system-lmf-runtime.json')
    expect(runtime.modelRef).toBe('/data/circuit-templates/12v-starting-system.json')
  })

  test.each(pages)('$css restyles onto shared tokens rather than a legacy palette', (page) => {
    const css = read(page.css)

    // Every Batch 1 stylesheet sources canonical AutoLearnPro tokens; the
    // slim starting-system delta additionally layers the shared circuit-lab
    // engineering stylesheet (asserted in the layering test above).
    expect(css).toContain('var(--tm-')
    expect(css).toContain('@media')

    // Classes emitted by the page JS remain styled (never renamed away),
    // either in the page stylesheet or in the layered shared stylesheet.
    for (const cls of page.requiredClasses) {
      expect(css).toContain(cls)
    }
    if (page.layeredClasses) {
      const layered = read('dashboard/student/circuit-lab/circuit-lab.css')
      for (const cls of page.layeredClasses) {
        expect(layered).toContain(cls)
      }
    }
  })

  test('circuit CSS constrains narrow-viewport overflow to the visualization container', () => {
    const css = read('dashboard/student/circuit-lab/circuit-lab.css')
    expect(css).toContain('overflow-x')
    expect(css).toContain('@media (max-width:420px)')
  })

  test('introduces no retired third-party certification trademark or taxonomy', () => {
    const combined = pages
      .map((page) => `${read(page.html)}\n${read(page.css)}\n${read(page.js)}`)
      .join('\n')
    const protectedMark = ['A', 'S', 'E'].join('')
    const organizationName = ['automotive', 'service', 'excellence'].join(' ')
    const certificationClaim = [protectedMark.toLowerCase(), 'certified'].join('-')
    const certifiedTechnician = ['certified', 'technician'].join(' ')
    expect(combined).not.toMatch(new RegExp('\\b' + protectedMark + '\\b'))
    expect(combined.toLowerCase()).not.toContain(organizationName)
    expect(combined).not.toMatch(/\bA[1-8]\b/)
    expect(combined).not.toMatch(/\bL1\b/)
    expect(combined).not.toMatch(/\bL3\b/)
    expect(combined.toLowerCase()).not.toContain(certifiedTechnician)
    expect(combined.toLowerCase()).not.toContain(certificationClaim)
  })

  test('circuit lab remains outside the animation integration while Starting System uses ANIM-2A', () => {
    const circuit = `${read('dashboard/student/circuit-lab/index.html')}\n${read('dashboard/student/circuit-lab/circuit-lab.css')}\n${read('dashboard/student/circuit-lab/circuit-lab.js')}`
    expect(circuit).not.toContain('animation-player')
    expect(circuit).not.toContain('animation-manifest')
    expect(circuit).not.toContain('blender-animation-pipeline')

    const startingHtml = read('dashboard/student/starting-system-lab/index.html')
    const startingIntegration = read('dashboard/student/starting-system-lab/starting-system-animation.js')
    expect(startingHtml).toContain('href="/theme/components/animation-player/animation-player.css"')
    expect(startingHtml).toContain('src="./starting-system-animation.js"')
    expect(startingIntegration).toContain('/data/architecture/student-lab-animation-source-of-truth.json')
    expect(startingIntegration).toContain('/theme/components/animation-player/animation-player.js')
    expect(startingIntegration).toContain('allowDraft: false')
    expect(startingIntegration).toContain("dataset.animationPublicationState = 'fail-closed'")
    expect(startingIntegration).not.toContain('allowDraft: true')
  })
})


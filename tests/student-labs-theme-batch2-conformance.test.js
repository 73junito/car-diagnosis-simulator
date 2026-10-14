/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8')

const pages = [
  {
    html: 'dashboard/student/relay-load-lab/index.html',
    css: 'dashboard/student/relay-load-lab/relay-load-lab.css',
    js: 'dashboard/student/relay-load-lab/relay-load-lab.js',
    pageScript: 'src="./relay-load-lab.js"',
    requiredIds: [
      'voltageProfile','stateSelect','faultSelect','showSystemFlow','traceControl',
      'tracePower','traceGround','resetView','measuredRelayCurrent',
      'relayMeasurementResult','relayComparisonSummary','engineeringStatus',
      'engSourceVoltage','engLoadResistance','engPathResistance','engCurrent',
      'engVoltageDrop','engLoadVoltage','engLoadPower','engConductorLoss',
      'engineeringFormula','stateBadge','circuitSvg','flowNote','inspectorContent','guidedSteps',
    ],
    jsMarkers: ['12v-relay-controlled-load.json','relay-load-training.json','RELAY_COIL','RELAY_CONTACT'],
  },
  {
    html: 'dashboard/student/sensor-lab/index.html',
    css: 'dashboard/student/sensor-lab/sensor-lab.css',
    js: 'dashboard/student/sensor-lab/sensor-lab.js',
    pageScript: 'src="./sensor-lab.js"',
    requiredIds: [
      'voltageProfile','stateSelect','faultSelect','showSystemFlow','tracePower',
      'traceSignal','traceGround','resetView','sensorInput','sensorInputValue',
      'measuredSensorSignal','sensorMeasurementResult','sensorComparisonSummary',
      'sensorEngineeringStatus','engSensorReference','engSignalRange','engIdealSignal',
      'engObservedSignal','sensorEngineeringFormula','stateBadge','circuitSvg','flowNote','inspectorContent',
    ],
    jsMarkers: ['three-wire-sensor','SENSOR5','TP_SENSOR_SUPPLY','TP_SENSOR_SIGNAL'],
  },
]

describe('Student labs shared-theme conformance (Batch 2: relay-load + sensor)', () => {
  test.each(pages)('$html loads canonical shared theme layers and drops legacy student.css', (page) => {
    const html = read(page.html)
    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain('href="/dashboard/student/circuit-lab/circuit-lab.css"')
    expect(html).toContain(page.css.split('/').pop())
    expect(html).not.toContain('href="../student.css"')
  })

  test.each(pages)('$html mounts the shared AutoLearnPro shell once', (page) => {
    const html = read(page.html)
    expect((html.match(/data-theme-shell/g) || [])).toHaveLength(1)
    expect(html).toContain('import { mountShell } from "/theme/shell.js"')
    expect(html).toContain('mountShell()')
    expect(html).toContain('class="lab-shell tm-main"')
    expect(html).toContain('class="tm-page-header"')
    expect(html).toContain('class="tm-page-title"')
    expect(html).toContain('class="tm-page-subtitle"')
    expect(html).toContain('AutoLearnPro')
  })

  test.each(pages)('$html preserves load-bearing ids, page script, and shared button classes', (page) => {
    const html = read(page.html)
    for (const id of page.requiredIds) expect(html).toContain('id="' + id + '"')
    expect(html).toContain(page.pageScript)
    expect(html).toContain('tm-btn tm-btn-secondary')
  })

  test.each(pages)('$js preserves canonical engineering/template behavior markers', (page) => {
    const js = read(page.js)
    for (const marker of page.jsMarkers) expect(js).toContain(marker)
  })

  test.each(pages)('$css uses shared tokens and keeps narrow viewport safeguards', (page) => {
    const css = read(page.css)
    expect(css).toContain('var(--tm-')
    expect(css).toContain('@media(max-width:420px)')
    expect(css).toContain('.button-row .tm-btn')
  })

  test.each(pages)('$html keeps diagram overflow explicitly localized', (page) => {
    const html = read(page.html)
    const css = read('dashboard/student/circuit-lab/circuit-lab.css') + '\n' + read(page.css)
    expect(html).toMatch(/class="diagram-scroll" aria-label="Scrollable/)
    expect(css).toContain('overflow-x:auto')
  })

  test('introduces no retired third-party certification trademark or taxonomy', () => {
    const combined = pages.map((page) => read(page.html) + '\n' + read(page.css) + '\n' + read(page.js)).join('\n')
    const protectedMark = ['A','S','E'].join('')
    expect(combined).not.toMatch(new RegExp('\\b' + protectedMark + '\\b'))
    const protectedOrganization = ['automotive','service','excellence'].join(' ')
    expect(combined.toLowerCase()).not.toContain(protectedOrganization)
    expect(combined).not.toMatch(/\bA[1-8]\b/)
    expect(combined).not.toMatch(/\bL1\b/)
    expect(combined).not.toMatch(/\bL3\b/)
  })

  test('introduces no animation workstream imports', () => {
    const combined = pages.map((page) => read(page.html) + '\n' + read(page.css) + '\n' + read(page.js)).join('\n')
    expect(combined).not.toMatch(/three(?:\.min|\.module)?\.js/i)
    expect(combined).not.toMatch(/(?:src|href)=["'][^"']*\/three\//i)
    expect(combined).not.toContain('animation-manifest')
    expect(combined).not.toContain('animation-player')
    expect(combined).not.toContain('blender-animation-pipeline')
  })
})

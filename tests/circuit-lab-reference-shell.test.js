/** @jest-environment node */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

describe('Circuit Lab reference presentation shell', () => {
  const html = read('dashboard/student/circuit-lab/index.html')
  const js = read('dashboard/student/circuit-lab/circuit-lab.js')
  const css = read('dashboard/student/circuit-lab/circuit-lab.css')
  const runtime = JSON.parse(read('data/architecture/circuit-lab-lmf-runtime.json'))

  test('establishes the five presentation regions without replacing runtime-owned controls', () => {
    for (const text of [
      'Safety &amp; limitations',
      'Scenario / work area',
      'Diagnostic tools',
      'Evidence &amp; observations',
      'Diagnostic reasoning',
      'Model status · explicit limitations'
    ]) {
      expect(html).toContain(text)
    }

    for (const id of [
      'stateSelect',
      'faultSelect',
      'showSystemFlow',
      'tracePower',
      'traceGround',
      'resetView',
      'circuitSvg',
      'inspectorContent',
      'guidedSteps',
      'chargingReferenceSelect',
      'chargingCurrentInput'
    ]) {
      expect(html).toContain(`id="${id}"`)
    }
  })

  test('renders new capability panels from the existing LMF runtime projection', () => {
    for (const id of ['labToolList', 'labMeasurementList', 'labFaultList', 'labModelStatus']) {
      expect(html).toContain(`id="${id}"`)
    }

    expect(js).toContain('runtime.toolIds')
    expect(js).toContain('runtime.measurementTypes')
    expect(js).toContain('runtime.faultClassIds')
    expect(js).toContain('runtime.directPracticeAllowed')
    expect(js).toContain('runtime.assessmentEligibilityAuthority')
    expect(js).toContain('runtime.publicationAuthority')

    expect(runtime.toolIds).toEqual(['tool.dmm', 'tool.current-clamp'])
    expect(runtime.engineeringAdapterId).toBe('electrical-circuit')
  })

  test('does not introduce UI-owned assessment or publication authority', () => {
    const combined = `${html}\n${js}`
    expect(combined).not.toContain('correctAnswer')
    expect(combined).not.toContain('assessmentEligible = true')
    expect(combined).not.toContain('publicationApproved = true')
    expect(combined).not.toContain('correctAnswer:')
    expect(combined).not.toContain('assessmentEligible:')
    expect(combined).not.toContain('publicationApproved:')
  })

  test('keeps responsive overflow inside the schematic container', () => {
    expect(css).toContain('.diagram-scroll { overflow-x:auto')
    expect(css).toContain('.lab-shell { min-width:0; overflow-x:clip; }')
    expect(css).toContain('@media (max-width:760px)')
    expect(css).toContain('@media (max-width:420px)')
  })

  test('provides visible focus treatment for interactive lab controls', () => {
    expect(css).toContain('.lab-shell select:focus-visible')
    expect(css).toContain('.lab-shell input:focus-visible')
    expect(css).toContain('.lab-shell button:focus-visible')
    expect(css).toContain('.lab-shell a:focus-visible')
  })
})

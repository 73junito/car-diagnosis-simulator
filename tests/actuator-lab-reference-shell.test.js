/** @jest-environment node */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

describe('Actuator Lab reference presentation shell', () => {
  const html = read('dashboard/student/actuator-lab/index.html')
  const js = read('dashboard/student/actuator-lab/actuator-lab.js')
  const css = read('dashboard/student/circuit-lab/circuit-lab.css')
  const runtime = JSON.parse(read('data/architecture/actuator-lab-lmf-runtime.json'))
  const template = JSON.parse(read('data/circuit-templates/12v-pwm-actuator.json'))
  const profile = JSON.parse(read('data/engineering/labs/actuator-training.json'))

  test('establishes the governed presentation regions without replacing runtime-owned controls', () => {
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
      'tracePwm',
      'traceGround',
      'resetView',
      'circuitSvg',
      'inspectorContent',
      'guidedSteps',
      'dutyInput',
      'measuredActuatorAverage'
    ]) {
      expect(html).toContain(`id="${id}"`)
    }
  })

  test('renders capability panels from the existing LMF runtime projection', () => {
    for (const id of ['labToolList', 'labMeasurementList', 'labFaultList', 'labModelStatus']) {
      expect(html).toContain(`id="${id}"`)
    }

    expect(js).toContain('runtime.toolIds')
    expect(js).toContain('runtime.measurementTypes')
    expect(js).toContain('runtime.faultClassIds')
    expect(js).toContain('runtime.directPracticeAllowed')
    expect(js).toContain('runtime.assessmentEligibilityAuthority')
    expect(js).toContain('runtime.publicationAuthority')

    expect(runtime.toolIds).toEqual([
      'tool.dmm',
      'tool.oscilloscope',
      'tool.scan-tool',
      'tool.current-clamp'
    ])
    expect(runtime.engineeringAdapterId).toBe('electrical-circuit')
    expect(runtime.directPracticeAllowed).toBe(true)
  })

  test('preserves the four declared test points and their vehicle-specific boundary', () => {
    expect(template.testPoints.map((point) => point.id)).toEqual([
      'TP_ACT_POWER',
      'TP_PWM',
      'TP_ACT_GROUND',
      'TP_ECM_PWM'
    ])
    expect(template.testPoints.every((point) => point.vehicleSpecificValueRequired === true)).toBe(true)
  })

  test('keeps project-authored PWM examples distinct from actuator response', () => {
    expect(profile.stateEngineering.map((entry) => [entry.stateId, entry.dutyCycle.value])).toEqual([
      ['pwm-low-example', 30],
      ['pwm-high-example', 70]
    ])
    expect(profile.notice).toMatch(/does not imply actuator position, speed, force, flow, current, or frequency/i)
    expect(html).toMatch(/does not (?:define|establish) actuator position, speed, force, flow, current, or frequency/i)
  })

  test('does not introduce UI-owned engineering, assessment, or publication authority', () => {
    const combined = `${html}\n${js}`
    expect(combined).not.toContain('correctAnswer')
    expect(combined).not.toContain('assessmentEligible = true')
    expect(combined).not.toContain('publicationApproved = true')
    expect(combined).not.toContain('actuatorPosition =')
    expect(combined).not.toContain('actuatorSpeed =')
    expect(combined).not.toContain('actuatorCurrent =')
  })

  test('inherits responsive overflow and visible focus treatment from the shared circuit shell', () => {
    expect(css).toContain('.diagram-scroll { overflow-x:auto')
    expect(css).toContain('.lab-shell { min-width:0; overflow-x:clip; }')
    expect(css).toContain('@media (max-width:760px)')
    expect(css).toContain('@media (max-width:420px)')
    expect(css).toContain('.lab-shell select:focus-visible')
    expect(css).toContain('.lab-shell input:focus-visible')
    expect(css).toContain('.lab-shell button:focus-visible')
    expect(css).toContain('.lab-shell a:focus-visible')
  })
})

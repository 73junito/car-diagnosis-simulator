/** @jest-environment node */
const fs = require('fs')
const path = require('path')
const { calculateSensorSignalState } = require('../src/engineering/sensor-state.js')

const ROOT = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const json = (relative) => JSON.parse(read(relative))

describe('cross-lab engineering contract semantics', () => {
  test('labels runtime measurementTypes as tool capability, not modeled output', () => {
    for (const lab of ['circuit-lab', 'starting-system-lab', 'relay-load-lab', 'sensor-lab', 'actuator-lab']) {
      const html = read(`dashboard/student/${lab}/index.html`)
      expect(html).toContain('Tool-supported measurement categories')
      expect(html).not.toContain('Declared measurement types')
    }
  })

  test('Circuit and Starting fault classes are derived from faults actually present in their models', () => {
    expect(json('data/architecture/circuit-lab-lmf-runtime.json').faultClassIds).toEqual([
      'electrical.open',
      'electrical.high-resistance'
    ])
    expect(json('data/architecture/starting-system-lmf-runtime.json').faultClassIds).toEqual([
      'electrical.open',
      'electrical.high-resistance'
    ])
  })

  test('Network runtime exposes only communications fault classes implemented by its concrete model', () => {
    expect(json('data/architecture/network-lab-lmf-runtime.json').faultClassIds).toEqual([
      'communications.open-bus',
      'communications.short-bus',
      'communications.node-offline'
    ])
    expect(json('data/architecture/network-lab-lmf-runtime.json').faultClassIds)
      .not.toContain('communications.data-integrity')
  })

  test('Charging operating-state flow belongs to the circuit model rather than page-owned state', () => {
    const model = json('data/circuits/generic-charging-system.json')
    const pageJs = read('dashboard/student/circuit-lab/circuit-lab.js')
    expect(model.operatingStates.map((state) => state.id)).toEqual([
      'key-off',
      'key-on',
      'engine-running'
    ])
    expect(model.operatingStates.every((state) => state.activeFlows && state.note)).toBe(true)
    expect(pageJs).toContain('circuit.operatingStates')
    expect(pageJs).not.toContain('const systemFlows = {')
  })

  test('2D and standalone Sensor presentations load the same engineering-state resolver', () => {
    const mainHtml = read('dashboard/student/sensor-lab/index.html')
    const roomHtml = read('dashboard/student/sensor-lab/sensor-lab-3d.html')
    const mainJs = read('dashboard/student/sensor-lab/sensor-lab.js')
    const roomJs = read('dashboard/student/sensor-lab/sensor-lab-classroom.js')
    expect(mainHtml).toContain('/src/engineering/sensor-state.js')
    expect(roomHtml).toContain('/src/engineering/sensor-state.js')
    expect(mainJs).toContain('TorqueMindSensorEngineeringState')
    expect(roomJs).toContain('TorqueMindSensorEngineeringState')
  })

  test('shared Sensor state resolver preserves conservative fault semantics', () => {
    const calculator = {
      calculateLinearTransfer: ({ inputPercent, outputMin, outputMax }) => ({
        quantityType: 'voltage',
        unit: 'V',
        value: outputMin + (inputPercent / 100) * (outputMax - outputMin)
      })
    }
    const base = {
      calculator,
      inputPercent: 50,
      signalRange: { min: 0.5, max: 4.5 },
      referenceVoltage: 5,
      operatingState: 'active-signal'
    }

    expect(calculateSensorSignalState(base).observed).toBe(2.5)
    expect(calculateSensorSignalState({ ...base, operatingState: 'key-on-powered' }).observed).toBeNull()

    const open = calculateSensorSignalState({
      ...base,
      faultBehavior: { mode: 'controller_signal_unavailable', reason: 'open' }
    })
    expect(open.transfer.value).toBe(2.5)
    expect(open.observed).toBeNull()

    const highResistance = calculateSensorSignalState({
      ...base,
      faultBehavior: { mode: 'sensor_output_not_inferred', reason: 'not inferred' }
    })
    expect(highResistance.transfer).toBeNull()
    expect(highResistance.observed).toBeNull()

    expect(calculateSensorSignalState({
      ...base,
      faultBehavior: { mode: 'controller_signal_forced_ground', reason: 'grounded' }
    }).observed).toBe(0)

    expect(calculateSensorSignalState({
      ...base,
      faultBehavior: { mode: 'controller_signal_forced_reference', reason: 'reference' }
    }).observed).toBe(5)
  })
})

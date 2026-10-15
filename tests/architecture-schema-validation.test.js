const {
  verifyArchitectureSchemas
} = require('../scripts/verify-architecture-schemas')

describe('central architecture schema validation', () => {
  test('validates authoritative runtime, observability, and all LMF runtime contracts', () => {
    const result = verifyArchitectureSchemas()

    expect(result.contractCount).toBe(6)
    expect(result.validatedFileCount).toBe(12)
    expect(result.lmfRuntimeCount).toBe(7)

    expect(result.results.map((item) => item.file)).toEqual(
      expect.arrayContaining([
        'data/architecture/runtime-matrix.json',
        'data/architecture/observability-contract.json',
        'data/architecture/starting-system-lmf-runtime.json',
        'data/architecture/circuit-lab-lmf-runtime.json',
        'data/architecture/network-lab-lmf-runtime.json',
        'data/architecture/multivoltage-lab-lmf-runtime.json',
        'data/architecture/relay-load-lab-lmf-runtime.json',
        'data/architecture/sensor-lab-lmf-runtime.json',
        'data/architecture/actuator-lab-lmf-runtime.json'
      ])
    )
  })
})

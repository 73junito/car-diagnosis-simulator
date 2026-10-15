/** @jest-environment node */
const fs = require('fs')
const path = require('path')
const Ajv = require('ajv')
const {
  validateAnimationPresentationContract,
  validateAnimationReleaseCandidate,
} = require('../scripts/verify-animation-presentation-contract')

const root = path.resolve(__dirname, '..')
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'animation-manifest.schema.json'), 'utf8'))
const review = JSON.parse(fs.readFileSync(path.join(root, 'animation', 'manifests', 'starting-system-voltage-drop-review.json'), 'utf8'))
const validateSchema = new Ajv({ allErrors: true, strict: false }).compile(schema)
const clone = (value) => JSON.parse(JSON.stringify(value))

function buildContract({ mode = 'animated', withAsset = false } = {}) {
  const manifest = clone(review)
  manifest.schemaVersion = '1.1.0'
  manifest.rendering.assetPath = withAsset ? 'animation/review-assets/starting-system-voltage-drop-review.glb' : null
  manifest.rendering.fallbackImagePath = 'animation/review-assets/starting-system-voltage-drop-review.svg'
  manifest.presentation = {
    contractVersion: '1.0.0',
    mode,
    simulationSource: { engineeringArtifactRef: 'data/circuit-templates/12v-starting-system.json' },
    componentBindings: {
      battery: { sourceType: 'engineering-component', engineeringComponentId: 'BAT1' },
      'control-protection': { sourceType: 'engineering-component', engineeringComponentId: 'FUSE1' },
      'start-command-switch': { sourceType: 'engineering-component', engineeringComponentId: 'SW1' },
      'starter-solenoid-coil': { sourceType: 'engineering-component', engineeringComponentId: 'SOL_COIL' },
      'starter-solenoid-contact': { sourceType: 'engineering-component', engineeringComponentId: 'SOL_CONTACT' },
      'starter-motor': { sourceType: 'engineering-component', engineeringComponentId: 'MTR1' },
      'ground-path': { sourceType: 'engineering-component', engineeringComponentId: 'GND1' },
      'positive-path': {
        sourceType: 'connection-derived',
        engineeringConnectionIds: ['W_BAT_CONTACT', 'W_CONTACT_MOTOR'],
      },
      'digital-multimeter': { sourceType: 'instructional-overlay' },
    },
    clips: mode === 'animated'
      ? [{ id: 'instructional-sequence', assetClipName: 'InstructionalSequence', durationSeconds: 4 }]
      : [],
    stateMappings: ['key-off', 'key-on', 'crank'].map((stateId) => ({ stateId, componentStates: [] })),
    faultMappings: [
      'FAULT_OPEN_CONTROL',
      'FAULT_OPEN_POWER',
      'FAULT_HIGH_RES_GROUND',
      'FAULT_HIGH_RES_POWER',
    ].map((faultId) => ({ faultId, componentStates: [] })),
  }

  manifest.steps = manifest.steps.map((step, index) => ({
    ...step,
    timeline: mode === 'animated'
      ? { kind: 'clip', clipId: 'instructional-sequence', startSeconds: index, endSeconds: index + 1 }
      : { kind: 'static-interval', startSeconds: index, endSeconds: index },
    highlightComponentIds: [...step.componentIds],
    camera: { behavior: 'frame-highlighted-components' },
  }))
  return manifest
}

describe('ANIM-2B canonical presentation contract', () => {
  test('keeps 1.0.0 manifests backward-compatible while requiring presentation on 1.1.0', () => {
    const legacy = clone(review)
    legacy.schemaVersion = '1.0.0'
    delete legacy.presentation
    for (const step of legacy.steps) {
      delete step.timeline
      delete step.highlightComponentIds
      delete step.camera
    }
    expect(validateSchema(legacy)).toBe(true)

    const next = clone(legacy)
    next.schemaVersion = '1.1.0'
    expect(validateSchema(next)).toBe(false)
    expect(validateSchema.errors.some((issue) => issue.message === "must have required property 'presentation'")).toBe(true)
  })

  test('accepts a complete animated draft contract before an asset is attached', () => {
    const manifest = buildContract()
    expect(validateSchema(manifest)).toBe(true)
    expect(validateAnimationPresentationContract(manifest, { rootDir: root })).toEqual([])
  })

  test('accepts an explicit static 3D draft with no meaningless animation clips', () => {
    const manifest = buildContract({ mode: 'static-3d', withAsset: false })
    expect(validateSchema(manifest)).toBe(true)
    expect(validateAnimationPresentationContract(manifest, { rootDir: root })).toEqual([])
  })

  test('rejects a static presentation that points at a GLB containing undeclared motion clips', () => {
    const manifest = buildContract({ mode: 'static-3d', withAsset: true })
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/GLB contains undeclared clip/)
  })

  test('rejects presentation modes that are incompatible with the declared renderer', () => {
    const manifest = buildContract({ mode: 'static-3d', withAsset: true })
    manifest.type = 'static-diagram'
    manifest.rendering.renderer = 'static'
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/static-3d presentation requires interactive-3d with three-js renderer/)
  })

  test('rejects unknown component references and incomplete canonical engineering bindings', () => {
    const manifest = buildContract()
    manifest.presentation.componentBindings.battery.engineeringComponentId = 'UNKNOWN'
    manifest.steps[0].highlightComponentIds.push('not-a-component')
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/unknown engineering component UNKNOWN/)
    expect(errors.join('\n')).toMatch(/engineering component is not canonically bound: BAT1/)
    expect(errors.join('\n')).toMatch(/highlights unknown component not-a-component/)
  })

  test('rejects incompatible operating-state and fault mappings', () => {
    const manifest = buildContract()
    manifest.presentation.stateMappings = manifest.presentation.stateMappings.filter((item) => item.stateId !== 'crank')
    manifest.presentation.faultMappings[0].faultId = 'FAULT_NOT_REAL'
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/operating state missing presentation mapping: crank/)
    expect(errors.join('\n')).toMatch(/unknown training fault FAULT_NOT_REAL/)
    expect(errors.join('\n')).toMatch(/training fault missing presentation mapping: FAULT_OPEN_CONTROL/)
  })

  test('rejects missing clips and invalid step timing', () => {
    const manifest = buildContract()
    manifest.steps[0].timeline.clipId = 'missing-clip'
    manifest.steps[1].timeline.startSeconds = 2
    manifest.steps[1].timeline.endSeconds = 1
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/references unknown clip missing-clip/)
    expect(errors.join('\n')).toMatch(/clip timing must have endSeconds > startSeconds/)
  })

  test('rejects an animated contract when the attached GLB does not contain the declared clip', () => {
    const manifest = buildContract({ withAsset: true })
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/GLB missing required clip InstructionalSequence/)
    expect(errors.join('\n')).toMatch(/GLB contains undeclared clip identify-current-path/)
  })

  test('automated validation can reject but cannot grant release authority', () => {
    const manifest = buildContract({ mode: 'static-3d', withAsset: true })
    const errors = validateAnimationReleaseCandidate(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/release requires final_content_approved/)
    expect(errors.join('\n')).toMatch(/release requires explicit human approval/)
    expect(errors.join('\n')).toMatch(/release requires explicit publication authorization/)
  })

  test('rejects missing fallback assets for ANIM-2B manifests', () => {
    const manifest = buildContract()
    manifest.rendering.fallbackImagePath = 'animation/review-assets/not-present.svg'
    const errors = validateAnimationPresentationContract(manifest, { rootDir: root })
    expect(errors.join('\n')).toMatch(/static fallback asset does not exist/)
  })
})

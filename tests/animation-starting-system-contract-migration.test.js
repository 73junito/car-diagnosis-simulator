/** @jest-environment node */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))

const foundation = readJson('animation/manifests/starting-system-voltage-drop-foundation.json')
const review = readJson('animation/manifests/starting-system-voltage-drop-review.json')
const template = readJson('data/circuit-templates/12v-starting-system.json')

const ids = (manifest) => manifest.components.map((item) => item.id)
const stateIds = (manifest) => manifest.presentation.stateMappings.map((item) => item.stateId)
const faultIds = (manifest) => manifest.presentation.faultMappings.map((item) => item.faultId)

describe('ANIM-2B Starting System schema 1.1 migration', () => {
  test('uses one canonical component vocabulary across foundation and review manifests', () => {
    expect(foundation.schemaVersion).toBe('1.1.0')
    expect(review.schemaVersion).toBe('1.1.0')
    expect(ids(foundation)).toEqual(ids(review))
    expect(ids(foundation)).toEqual([
      'battery',
      'control-protection',
      'start-command-switch',
      'starter-solenoid-coil',
      'starter-solenoid-contact',
      'starter-motor',
      'positive-path',
      'ground-path',
      'digital-multimeter',
    ])
  })

  test('binds every engineering component exactly once while keeping path and meter presentation identities explicit', () => {
    const bindings = foundation.presentation.componentBindings
    const engineeringIds = Object.values(bindings)
      .filter((item) => item.sourceType === 'engineering-component')
      .map((item) => item.engineeringComponentId)
      .sort()
    expect(engineeringIds).toEqual(template.components.map((item) => item.id).sort())
    expect(bindings['positive-path']).toEqual({
      sourceType: 'connection-derived',
      engineeringConnectionIds: ['W_BAT_FUSE', 'W_FUSE_SWITCH', 'W_BAT_CONTACT', 'W_CONTACT_MOTOR'],
    })
    expect(bindings['digital-multimeter']).toEqual({ sourceType: 'instructional-overlay' })
    expect(review.presentation.componentBindings).toEqual(bindings)
  })

  test('maps all authoritative operating states and training faults in both manifests', () => {
    const authoritativeStates = template.operatingStates.map((item) => item.id)
    const authoritativeFaults = template.faultCatalog.map((item) => item.id)
    expect(stateIds(foundation)).toEqual(authoritativeStates)
    expect(stateIds(review)).toEqual(authoritativeStates)
    expect(faultIds(foundation)).toEqual(authoritativeFaults)
    expect(faultIds(review)).toEqual(authoritativeFaults)
  })

  test('keeps the current representations explicitly static until real Blender clips exist', () => {
    expect(foundation.presentation.mode).toBe('static-2d')
    expect(foundation.type).toBe('static-diagram')
    expect(foundation.rendering.renderer).toBe('static')
    expect(foundation.presentation.clips).toEqual([])
    expect(foundation.rendering.assetPath).toBeNull()
    expect(foundation.rendering.fallbackImagePath).toBe('animation/fallbacks/starting-system-voltage-drop.svg')

    expect(review.presentation.mode).toBe('static-3d')
    expect(review.presentation.clips).toEqual([])
    expect(review.rendering.assetPath).toBe('animation/review-assets/starting-system-voltage-drop-review.glb')
  })

  test('maps every instructional step to a validated static interval with highlights and camera behavior', () => {
    for (const manifest of [foundation, review]) {
      for (const step of manifest.steps) {
        expect(step.timeline).toEqual({ kind: 'static-interval', startSeconds: 0, endSeconds: 0 })
        expect(step.highlightComponentIds).toEqual(step.componentIds)
        expect(step.camera).toEqual({ behavior: 'frame-highlighted-components' })
      }
    }
  })

  test('preserves fail-closed release and assessment governance', () => {
    for (const manifest of [foundation, review]) {
      expect(manifest.governance.humanApprovalRecorded).toBe(false)
      expect(manifest.governance.publicationAllowed).toBe(false)
      expect(manifest.governance.assessmentEligible).toBe(false)
      expect(manifest.governance.scoredAssessmentApproved).toBe(false)
      expect(manifest.governance.agentMayApprove).toBe(false)
      expect(manifest.governance.agentMayRelease).toBe(false)
    }
  })

  test('deploys only the governed static fallback and keeps review GLB isolated', () => {
    const build = fs.readFileSync(path.join(root, 'scripts', 'build-static-site.js'), 'utf8')
    expect(build).toContain('"animation/fallbacks/starting-system-voltage-drop.svg"')
    expect(build).not.toContain('"animation/review-assets/starting-system-voltage-drop-review.glb"')
    expect(build).not.toContain('"animation/manifests/starting-system-voltage-drop-review.json"')
  })
})

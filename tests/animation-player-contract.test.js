import fs from 'fs'
import path from 'path'
import { mountAnimationPlayer, validateAnimationRuntimeManifest } from '../theme/components/animation-player/animation-player.js'

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'animation', 'manifests', 'starting-system-voltage-drop-foundation.json'), 'utf8'))
const reviewManifest = JSON.parse(fs.readFileSync(path.join(root, 'animation', 'manifests', 'starting-system-voltage-drop-review.json'), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))

function createRuntimeStub({ onPlayClip } = {}) {
  return {
    setPlaying: jest.fn(),
    playClip: jest.fn((name, options) => {
      if (onPlayClip) return onPlayClip(name, options)
      return { clipName: name, ...options }
    }),
    seekClip: jest.fn(),
    seekNormalized: jest.fn(),
    resetCamera: jest.fn(),
    selectComponent: jest.fn(),
    dispose: jest.fn(),
    hasAnimations: true,
    availableClips: reviewManifest.presentation.clips.map((clip) => clip.assetClipName),
    availableComponents: reviewManifest.components.map((component) => component.id),
  }
}

describe('ANIM-1B Three.js player contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="player"></div>'
    window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
  })

  test('keeps draft manifests fail-closed by default', () => {
    const result = validateAnimationRuntimeManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/not approved for publication/)
    expect(result.canRender3d).toBe(false)
  })

  test('allows explicit draft preview without loading Three.js when no asset exists', async () => {
    const runtimeFactory = jest.fn(() => { throw new Error('runtime must not load') })
    const container = document.getElementById('player')
    const controller = await mountAnimationPlayer({ container, manifest, allowDraft: true, runtimeFactory })
    expect(controller.validation.ok).toBe(true)
    expect(controller.validation.canRender3d).toBe(false)
    expect(runtimeFactory).not.toHaveBeenCalled()
    expect(container.querySelector('[data-animation-draft-placeholder]')).not.toBeNull()
    expect(container.querySelector('[role="status"]').textContent).toMatch(/3D asset not yet attached/)
  })

  test('requires human publication approval, model asset, and static fallback for published 3D', () => {
    const candidate = clone(manifest)
    candidate.governance.status = 'final_content_approved'
    candidate.governance.humanApprovalRecorded = true
    candidate.governance.publicationAllowed = true
    candidate.type = 'interactive-3d'
    candidate.rendering.renderer = 'three-js'
    candidate.rendering.assetPath = null
    candidate.rendering.fallbackImagePath = null
    const missingAssets = validateAnimationRuntimeManifest(candidate)
    expect(missingAssets.ok).toBe(false)
    expect(missingAssets.errors.join('\n')).toMatch(/model asset/)
    expect(missingAssets.errors.join('\n')).toMatch(/static fallback/)

    candidate.rendering.assetPath = 'animation/assets/starting-system.glb'
    candidate.rendering.fallbackImagePath = 'animation/fallbacks/starting-system.png'
    const approved = validateAnimationRuntimeManifest(candidate)
    expect(approved.ok).toBe(true)
    expect(approved.canRender3d).toBe(true)
  })

  test('rejects remote and parent-traversal runtime asset paths', () => {
    const candidate = clone(manifest)
    candidate.governance.status = 'final_content_approved'
    candidate.governance.humanApprovalRecorded = true
    candidate.governance.publicationAllowed = true
    candidate.rendering.assetPath = 'https://example.com/model.glb'
    candidate.rendering.fallbackImagePath = '../fallback.png'
    const result = validateAnimationRuntimeManifest(candidate)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/same-origin|inside the deployed application/)
  })

  test('preserves assessment and autonomous-release boundaries', () => {
    const candidate = clone(manifest)
    candidate.governance.assessmentEligible = true
    candidate.governance.scoredAssessmentApproved = true
    candidate.governance.agentMayApprove = true
    const result = validateAnimationRuntimeManifest(candidate, { allowDraft: true })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/assessment eligibility/)
    expect(result.errors.join('\n')).toMatch(/scored-assessment/)
    expect(result.errors.join('\n')).toMatch(/may not approve/)
  })

  test('uses an accessible player shell and explicit live status', async () => {
    const container = document.getElementById('player')
    await mountAnimationPlayer({ container, manifest, allowDraft: true })
    expect(container.classList.contains('tm-animation-player')).toBe(true)
    expect(container.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull()
    expect(container.querySelector('.tm-animation-player__purpose').textContent).toBe(manifest.instructionalPurpose)
  })

  test('maps instructional steps to manifest-declared named clips', async () => {
    const runtime = createRuntimeStub()
    const container = document.getElementById('player')
    await mountAnimationPlayer({
      container,
      manifest: reviewManifest,
      allowDraft: true,
      runtimeFactory: jest.fn().mockResolvedValue(runtime),
    })

    expect(runtime.playClip).toHaveBeenNthCalledWith(1, 'identify-current-path', {
      startSeconds: 0,
      endSeconds: 1,
      play: false,
    })

    container.querySelector('[data-animation-action="next-step"]').click()
    expect(runtime.playClip).toHaveBeenLastCalledWith('identify-control-path', {
      startSeconds: 0,
      endSeconds: 1,
      play: false,
    })

    container.querySelector('[data-animation-action="play"]').click()
    expect(runtime.playClip).toHaveBeenLastCalledWith('identify-control-path', {
      startSeconds: 0,
      endSeconds: 1,
      play: true,
    })
  })

  test('preserves legacy global playback for 1.0 manifests without named presentation clips', async () => {
    const legacy = clone(reviewManifest)
    legacy.schemaVersion = '1.0.0'
    delete legacy.presentation
    for (const step of legacy.steps) {
      delete step.timeline
      delete step.highlightComponentIds
      delete step.camera
    }
    const runtime = createRuntimeStub()
    const container = document.getElementById('player')
    await mountAnimationPlayer({
      container,
      manifest: legacy,
      allowDraft: true,
      runtimeFactory: jest.fn().mockResolvedValue(runtime),
    })

    expect(runtime.playClip).not.toHaveBeenCalled()
    container.querySelector('[data-animation-action="play"]').click()
    expect(runtime.setPlaying).toHaveBeenLastCalledWith(true)
  })

  test('reduced motion permits step navigation without starting clip motion', async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    const runtime = createRuntimeStub()
    const container = document.getElementById('player')
    await mountAnimationPlayer({
      container,
      manifest: reviewManifest,
      allowDraft: true,
      runtimeFactory: jest.fn().mockResolvedValue(runtime),
    })

    expect(container.querySelector('[data-animation-action="play"]').disabled).toBe(true)
    container.querySelector('[data-animation-action="next-step"]').click()
    expect(runtime.playClip).toHaveBeenLastCalledWith('identify-control-path', {
      startSeconds: 0,
      endSeconds: 1,
      play: false,
    })
    expect(runtime.playClip.mock.calls.some(([, options]) => options.play === true)).toBe(false)
  })

  test('fails closed to the static fallback when a named GLB clip is unavailable', async () => {
    const runtime = createRuntimeStub({
      onPlayClip(name) { throw new Error('Animation clip is unavailable: ' + name) },
    })
    const container = document.getElementById('player')
    const controller = await mountAnimationPlayer({
      container,
      manifest: reviewManifest,
      allowDraft: true,
      runtimeFactory: jest.fn().mockResolvedValue(runtime),
    })

    expect(controller.runtime).toBe(runtime)
    expect(container.querySelector('.tm-animation-player__canvas').hidden).toBe(true)
    expect(container.querySelector('figure.tm-animation-player__fallback').hidden).toBe(false)
    expect(container.querySelector('[data-animation-runtime-failure]')).not.toBeNull()
    expect(container.querySelector('[role="status"]').textContent).toBe('Fallback displayed')
  })

  test('rejects animated runtime manifests whose steps do not reference declared clips', () => {
    const candidate = clone(reviewManifest)
    candidate.presentation.clips = []
    const result = validateAnimationRuntimeManifest(candidate, { allowDraft: true })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/declared clips/)
  })

  test('pins Three.js without adding React and packages only same-origin runtime modules', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    expect(pkg.dependencies.three).toBe('^0.186.1')
    expect(pkg.dependencies.react).toBeUndefined()
    expect(pkg.dependencies['@react-three/fiber']).toBeUndefined()
    const build = fs.readFileSync(path.join(root, 'scripts', 'build-static-site.js'), 'utf8')
    expect(build).toContain('node_modules/three/build/three.module.js')
    expect(build).toContain('node_modules/three/build/three.core.js')
    expect(build).toContain('node_modules/three/examples/jsm/loaders/GLTFLoader.js')
    expect(build).toContain('node_modules/three/examples/jsm/controls/OrbitControls.js')
    expect(build).toContain('node_modules/three/LICENSE')
    expect(build).not.toMatch(/cdn\.jsdelivr|unpkg|esm\.sh/)
  })

  test('runtime source exposes GLB loading, selection, stepping support, reset, and reduced motion', () => {
    const runtime = fs.readFileSync(path.join(root, 'theme', 'components', 'animation-player', 'three-runtime.js'), 'utf8')
    const player = fs.readFileSync(path.join(root, 'theme', 'components', 'animation-player', 'animation-player.js'), 'utf8')
    expect(runtime).toContain('GLTFLoader')
    expect(runtime).toContain('OrbitControls')
    expect(runtime).toContain('loadAsync(assetUrl)')
    expect(runtime).toContain('selectComponent')
    expect(runtime).toContain('playClip')
    expect(runtime).toContain('seekClip')
    expect(runtime).toContain('availableClips')
    expect(runtime).toContain('resetCamera')
    expect(player).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(player).toContain('Previous step')
    expect(player).toContain('Next step')
  })
})

import { createThreeAnimationRuntime } from './three-runtime.js'

const FINAL_STATUS = 'final_content_approved'

function normalizePath(value) {
  if (!value) return null
  const stringValue = String(value)
  if (/^[a-z][a-z0-9+.-]*:/i.test(stringValue) || stringValue.startsWith('//')) {
    throw new Error('Animation runtime assets must use same-origin repository paths.')
  }
  const normalized = stringValue.replace(/\\/g, '/').replace(/^\.?\//, '')
  if (!normalized || normalized.includes('..')) {
    throw new Error('Animation runtime assets must stay inside the deployed application.')
  }
  return '/' + normalized
}

export function validateAnimationRuntimeManifest(manifest, { allowDraft = false } = {}) {
  const errors = []
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['Animation manifest is missing.'], canRender3d: false }
  }
  if (manifest.governance?.assessmentEligible !== false) errors.push('Animation manifests must remain outside assessment eligibility.')
  if (manifest.governance?.scoredAssessmentApproved !== false) errors.push('Animation manifests must remain outside scored-assessment approval.')
  if (manifest.governance?.agentMayApprove !== false || manifest.governance?.agentMayRelease !== false) {
    errors.push('Animation agents may not approve or release instructional artifacts.')
  }

  const published = manifest.governance?.status === FINAL_STATUS &&
    manifest.governance?.humanApprovalRecorded === true &&
    manifest.governance?.publicationAllowed === true

  if (!published && !allowDraft) errors.push('Animation is not approved for publication.')

  if (manifest.classification === 'vehicle-specific') {
    if (!manifest.governance?.vehicleSpecificClaims) errors.push('Vehicle-specific animations must declare vehicle-specific claims.')
    if (!Array.isArray(manifest.evidence?.approvedEvidenceRefs) || manifest.evidence.approvedEvidenceRefs.length === 0) {
      errors.push('Vehicle-specific animations require approved evidence.')
    }
  }

  const interactive3d = manifest.type === 'interactive-3d' && manifest.rendering?.renderer === 'three-js'
  let assetUrl = null
  let fallbackUrl = null
  try {
    assetUrl = normalizePath(manifest.rendering?.assetPath)
    fallbackUrl = normalizePath(manifest.rendering?.fallbackImagePath)
  } catch (error) {
    errors.push(error.message)
  }

  if (published && interactive3d && !assetUrl) errors.push('Published interactive 3D animations require a deployable model asset.')
  if (published && interactive3d && !fallbackUrl) errors.push('Published interactive 3D animations require a static fallback image.')

  for (const key of ['keyboardOperable', 'reducedMotionRequired', 'staticFallbackRequired', 'textAlternativeRequired']) {
    if (manifest.accessibility?.[key] !== true) {
      errors.push('Interactive animation accessibility contract is incomplete.')
      break
    }
  }

  if (manifest.schemaVersion === '1.1.0' && manifest.presentation?.mode === 'animated') {
    const declaredClipIds = new Set((manifest.presentation.clips || []).map((clip) => clip.id))
    if (declaredClipIds.size === 0) errors.push('Animated presentation requires declared clips.')
    for (const step of manifest.steps || []) {
      if (step.timeline?.kind !== 'clip' || !declaredClipIds.has(step.timeline.clipId)) {
        errors.push('Animated instructional steps must reference declared presentation clips.')
        break
      }
    }
  }

  return { ok: errors.length === 0, errors, published, canRender3d: errors.length === 0 && interactive3d && Boolean(assetUrl), assetUrl, fallbackUrl }
}

function buildButton(label, action, disabled = false) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'tm-btn tm-btn-secondary tm-animation-player__control'
  button.dataset.animationAction = action
  button.textContent = label
  button.disabled = disabled
  return button
}

function renderTextFallback(container, manifest, reason) {
  const fallback = document.createElement('div')
  fallback.className = 'tm-animation-player__fallback'
  fallback.dataset.animationFallback = ''
  const heading = document.createElement('strong')
  heading.textContent = manifest?.title || 'Instructional animation'
  const text = document.createElement('p')
  text.textContent = reason || manifest?.instructionalPurpose || 'A text alternative is available for this instructional visualization.'
  fallback.append(heading, text)
  container.append(fallback)
  return fallback
}

async function loadManifest(manifestUrl) {
  if (!manifestUrl) throw new Error('A manifest object or manifest URL is required.')
  const response = await fetch(manifestUrl, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Animation manifest could not be loaded.')
  return response.json()
}

export async function mountAnimationPlayer({
  container,
  manifest = null,
  manifestUrl = null,
  allowDraft = false,
  runtimeFactory = createThreeAnimationRuntime,
} = {}) {
  if (!(container instanceof Element)) throw new Error('mountAnimationPlayer requires a container element.')

  const resolvedManifest = manifest || await loadManifest(manifestUrl)
  const validation = validateAnimationRuntimeManifest(resolvedManifest, { allowDraft })
  container.replaceChildren()
  container.classList.add('tm-animation-player')
  container.dataset.animationId = resolvedManifest?.animationId || ''

  const heading = document.createElement('div')
  heading.className = 'tm-animation-player__heading'
  const headingText = document.createElement('div')
  const eyebrow = document.createElement('p')
  eyebrow.className = 'tm-animation-player__eyebrow'
  eyebrow.textContent = resolvedManifest?.classification?.replace('-', ' ') || 'instructional animation'
  const title = document.createElement('h2')
  title.className = 'tm-animation-player__title'
  title.textContent = resolvedManifest?.title || 'Instructional animation'
  const purpose = document.createElement('p')
  purpose.className = 'tm-animation-player__purpose'
  purpose.textContent = resolvedManifest?.instructionalPurpose || ''
  headingText.append(eyebrow, title, purpose)

  const status = document.createElement('div')
  status.className = 'tm-animation-player__status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.textContent = validation.published ? 'Ready' : allowDraft ? 'Draft preview' : 'Unavailable'
  heading.append(headingText, status)
  container.append(heading)

  if (!validation.ok) {
    renderTextFallback(container, resolvedManifest, validation.errors[0])
    return { manifest: resolvedManifest, validation, runtime: null, dispose() {} }
  }

  const stage = document.createElement('div')
  stage.className = 'tm-animation-player__stage'
  const canvas = document.createElement('canvas')
  canvas.className = 'tm-animation-player__canvas'
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', resolvedManifest.title + '. ' + resolvedManifest.instructionalPurpose)
  stage.append(canvas)

  const textAlternative = document.createElement('p')
  textAlternative.className = 'tm-animation-player__text-alternative'
  textAlternative.textContent = resolvedManifest.instructionalPurpose
  stage.append(textAlternative)

  let fallback = null
  if (validation.fallbackUrl) {
    fallback = document.createElement('figure')
    fallback.className = 'tm-animation-player__fallback'
    fallback.hidden = true
    const image = document.createElement('img')
    image.src = validation.fallbackUrl
    image.alt = resolvedManifest.title + ' static instructional fallback'
    const caption = document.createElement('figcaption')
    caption.textContent = resolvedManifest.instructionalPurpose
    fallback.append(image, caption)
    stage.append(fallback)
  }
  container.append(stage)

  const controls = document.createElement('div')
  controls.className = 'tm-animation-player__controls'
  controls.setAttribute('aria-label', 'Animation controls')
  const prefersReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const playButton = buildButton('Play', 'play', prefersReducedMotion)
  const pauseButton = buildButton('Pause', 'pause')
  const previousButton = buildButton('Previous step', 'previous-step')
  const nextButton = buildButton('Next step', 'next-step')
  const resetButton = buildButton('Reset camera', 'reset-camera')
  const fallbackButton = fallback ? buildButton('Show static fallback', 'fallback') : null

  if (resolvedManifest.controls?.play) controls.append(playButton)
  if (resolvedManifest.controls?.pause) controls.append(pauseButton)
  if (resolvedManifest.controls?.stepBackward) controls.append(previousButton)
  if (resolvedManifest.controls?.stepForward) controls.append(nextButton)
  if (resolvedManifest.controls?.resetCamera) controls.append(resetButton)
  if (fallbackButton) controls.append(fallbackButton)

  let componentSelect = null
  if (resolvedManifest.controls?.componentSelect && Array.isArray(resolvedManifest.components)) {
    const label = document.createElement('label')
    label.className = 'tm-animation-player__component-label'
    label.textContent = 'Highlight component'
    componentSelect = document.createElement('select')
    componentSelect.className = 'tm-animation-player__component-select'
    componentSelect.dataset.animationAction = 'component-select'
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = 'Choose a component'
    componentSelect.append(empty)
    for (const component of resolvedManifest.components) {
      const option = document.createElement('option')
      option.value = component.id
      option.textContent = component.label
      componentSelect.append(option)
    }
    label.append(componentSelect)
    controls.append(label)
  }
  container.append(controls)

  const steps = Array.isArray(resolvedManifest.steps) ? resolvedManifest.steps : []
  const stepPanel = document.createElement('div')
  stepPanel.className = 'tm-animation-player__step'
  stepPanel.tabIndex = -1
  const stepLabel = document.createElement('strong')
  const stepDescription = document.createElement('p')
  stepPanel.append(stepLabel, stepDescription)
  container.append(stepPanel)

  let currentStep = 0
  function renderStep() {
    const step = steps[currentStep]
    if (!step) {
      stepLabel.textContent = 'Instructional sequence'
      stepDescription.textContent = resolvedManifest.instructionalPurpose
      return
    }
    stepLabel.textContent = (currentStep + 1) + ' of ' + steps.length + ': ' + step.label
    stepDescription.textContent = step.description
  }
  renderStep()

  if (!validation.canRender3d) {
    canvas.hidden = true
    status.textContent = 'Draft manifest ready; 3D asset not yet attached'
    const placeholder = renderTextFallback(stage, resolvedManifest, 'The governed player is ready, but this draft does not yet contain an approved 3D model asset.')
    placeholder.dataset.animationDraftPlaceholder = ''
    return { manifest: resolvedManifest, validation, runtime: null, dispose() {} }
  }

  let runtime
  try {
    status.textContent = 'Loading 3D model'
    runtime = await runtimeFactory({
      canvas,
      assetUrl: validation.assetUrl,
      components: resolvedManifest.components,
      reducedMotion: prefersReducedMotion,
      onComponentSelect(componentId) {
        if (componentSelect) componentSelect.value = componentId
        const component = resolvedManifest.components.find((item) => item.id === componentId)
        status.textContent = component ? 'Selected ' + component.label : 'Component selected'
      },
      onError() { status.textContent = '3D model unavailable' },
    })
    status.textContent = prefersReducedMotion ? 'Ready — motion reduced' : 'Ready'
  } catch (error) {
    canvas.hidden = true
    if (fallback) fallback.hidden = false
    renderTextFallback(stage, resolvedManifest, 'The 3D model could not be loaded. The instructional fallback remains available.')
    status.textContent = 'Fallback displayed'
    return { manifest: resolvedManifest, validation, runtime: null, error, dispose() {} }
  }

  const declaredClips = new Map((resolvedManifest.presentation?.clips || []).map((clip) => [clip.id, clip]))

  function showRuntimeFallback(reason) {
    runtime?.setPlaying?.(false)
    canvas.hidden = true
    if (fallback) fallback.hidden = false
    status.textContent = 'Fallback displayed'
    const existing = stage.querySelector('[data-animation-runtime-failure]')
    if (!existing) {
      const message = renderTextFallback(stage, resolvedManifest, reason || 'The requested animation clip is unavailable. The instructional fallback remains available.')
      message.dataset.animationRuntimeFailure = ''
    }
  }

  function activateCurrentStep({ play = false } = {}) {
    if (!steps.length) return true
    const step = steps[currentStep]
    renderStep()

    try {
      if (step.timeline?.kind === 'clip') {
        const clip = declaredClips.get(step.timeline.clipId)
        if (!clip) throw new Error('Instructional step references an undeclared animation clip: ' + step.timeline.clipId)
        if (typeof runtime.playClip !== 'function') throw new Error('Animation runtime does not support named clip playback.')
        runtime.playClip(clip.assetClipName, {
          startSeconds: step.timeline.startSeconds,
          endSeconds: step.timeline.endSeconds,
          play: Boolean(play) && !prefersReducedMotion,
        })
      } else {
        const denominator = Math.max(steps.length - 1, 1)
        runtime.setPlaying(false)
        runtime.seekNormalized(currentStep / denominator)
      }
    } catch (error) {
      showRuntimeFallback(error.message)
      return false
    }

    status.textContent = play && !prefersReducedMotion
      ? 'Playing step ' + (currentStep + 1) + ' of ' + steps.length
      : 'Step ' + (currentStep + 1) + ' of ' + steps.length
    return true
  }

  if (!activateCurrentStep({ play: false })) {
    return { manifest: resolvedManifest, validation, runtime, dispose() { runtime?.dispose?.() } }
  }

  playButton.addEventListener('click', () => {
    if (resolvedManifest.presentation?.mode === 'animated') activateCurrentStep({ play: true })
    else { runtime.setPlaying(true); status.textContent = 'Playing' }
  })
  pauseButton.addEventListener('click', () => { runtime.setPlaying(false); status.textContent = 'Paused' })
  previousButton.addEventListener('click', () => {
    currentStep = Math.max(0, currentStep - 1)
    runtime.setPlaying(false)
    activateCurrentStep({ play: false })
  })
  nextButton.addEventListener('click', () => {
    currentStep = Math.min(Math.max(steps.length - 1, 0), currentStep + 1)
    runtime.setPlaying(false)
    activateCurrentStep({ play: false })
  })
  resetButton.addEventListener('click', () => { runtime.resetCamera(); status.textContent = 'Camera reset' })
  fallbackButton?.addEventListener('click', () => {
    const showingFallback = fallback.hidden
    fallback.hidden = !showingFallback
    canvas.hidden = showingFallback
    fallbackButton.textContent = showingFallback ? 'Show interactive model' : 'Show static fallback'
    status.textContent = showingFallback ? 'Static fallback displayed' : 'Interactive model displayed'
  })
  componentSelect?.addEventListener('change', () => {
    if (!componentSelect.value) return
    runtime.selectComponent(componentSelect.value)
    const component = resolvedManifest.components.find((item) => item.id === componentSelect.value)
    status.textContent = component ? 'Selected ' + component.label : 'Component selected'
  })

  return { manifest: resolvedManifest, validation, runtime, dispose() { runtime?.dispose?.() } }
}

const SOURCE_OF_TRUTH_URL = '/data/architecture/student-lab-animation-source-of-truth.json'

async function loadJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Animation source-of-truth data could not be loaded.')
  return response.json()
}

async function bootStartingSystemAnimation() {
  const container = document.getElementById('startingAnimationPlayer')
  const fallback = document.getElementById('startingLegacyVisualization')
  if (!container || !fallback) return

  try {
    const registry = await loadJson(SOURCE_OF_TRUTH_URL)
    const integration = registry.lab_integrations?.find((item) => item.lab_id === 'starting-system-lab')
    if (!integration) throw new Error('Starting System animation integration is not registered.')

    container.dataset.animationSourceOfTruth = SOURCE_OF_TRUTH_URL
    container.dataset.animationIntegrationStatus = integration.status
    fallback.dataset.animationFallbackRole = integration.legacy_visualization?.role || 'transitional-static-and-2d-fallback'

    const { mountAnimationPlayer } = await import('/theme/components/animation-player/animation-player.js')
    const controller = await mountAnimationPlayer({
      container,
      manifestUrl: '/' + integration.production_manifest.replace(/^\//, ''),
      allowDraft: false,
    })

    if (controller.validation.published) {
      container.dataset.animationPublicationState = 'published'
      fallback.hidden = true
      fallback.setAttribute('aria-hidden', 'true')
    } else {
      container.dataset.animationPublicationState = 'fail-closed'
      fallback.hidden = false
      fallback.removeAttribute('aria-hidden')
    }
  } catch (error) {
    container.dataset.animationPublicationState = 'fail-closed'
    container.replaceChildren()
    const status = document.createElement('div')
    status.className = 'tm-animation-player__fallback'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    status.textContent = 'The governed 3D animation is unavailable. The 2D instructional schematic remains available below.'
    container.append(status)
    fallback.hidden = false
    fallback.removeAttribute('aria-hidden')
    console.error('Starting System animation integration failed closed:', error)
  }
}

bootStartingSystemAnimation()

import { mountAnimationPlayer } from '/theme/components/animation-player/animation-player.js'

const MANIFEST_URL = '/animation/manifests/starting-system-voltage-drop-review.json'

function setText(selector, value) {
  const element = document.querySelector(selector)
  if (element) element.textContent = String(value)
}

async function loadJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Review resource could not be loaded: ' + url)
  return response.json()
}

async function initializeReviewHarness() {
  const container = document.getElementById('starting-system-review-player')
  const manifest = await loadJson(MANIFEST_URL)

  if (manifest.governance?.publicationAllowed !== false ||
      manifest.governance?.humanApprovalRecorded !== false ||
      manifest.governance?.assessmentEligible !== false ||
      manifest.governance?.scoredAssessmentApproved !== false) {
    throw new Error('Review harness refuses manifests that cross the review-only governance boundary.')
  }

  setText('[data-review-governance]', 'Human approval: not recorded · Publication: denied · Assessment: ineligible')
  setText('[data-review-animation-id]', manifest.animationId)
  setText('[data-review-presentation-mode]', manifest.presentation?.mode || 'unknown')
  setText('[data-review-clip-count]', (manifest.presentation?.clips || []).length)
  setText('[data-review-publication]', manifest.governance.publicationAllowed)
  setText('[data-review-assessment]', manifest.governance.assessmentEligible)

  const clipList = document.querySelector('[data-review-clip-list]')
  for (const clip of manifest.presentation?.clips || []) {
    const item = document.createElement('li')
    item.textContent = clip.id + ' → ' + clip.assetClipName + ' (' + clip.durationSeconds + ' s)'
    clipList.append(item)
  }

  const controller = await mountAnimationPlayer({
    container,
    manifest,
    allowDraft: true,
  })

  const runtimeClips = controller.runtime?.availableClips || []
  setText('[data-review-runtime-clips]', runtimeClips.length ? runtimeClips.join(', ') : 'unavailable')

  document.documentElement.dataset.reviewHarnessReady = controller.runtime ? 'true' : 'fallback'
  return controller
}

initializeReviewHarness().catch((error) => {
  console.error(error)
  setText('[data-review-governance]', 'Harness failed closed: ' + error.message)
  document.documentElement.dataset.reviewHarnessReady = 'error'
})

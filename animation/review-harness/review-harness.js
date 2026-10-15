import { mountAnimationPlayer } from '/theme/components/animation-player/animation-player.js'

const MANIFEST_URL = '/animation/manifests/starting-system-voltage-drop-review.json'
const REVIEW_TEMPLATE_URL = '/animation/reviews/starting-system-voltage-drop-review-template.json'

function setText(selector, value) {
  const element = document.querySelector(selector)
  if (element) element.textContent = String(value)
}

async function loadJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Review resource could not be loaded: ' + url)
  return response.json()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function renderReviewCriteria(template) {
  const roleSelect = document.querySelector('[data-human-review-role]')
  const criteriaRoot = document.querySelector('[data-human-review-criteria]')

  function render() {
    criteriaRoot.replaceChildren()
    const role = roleSelect.value
    const criteria = template.criteria?.[role] || []
    for (const criterion of criteria) {
      const fieldset = document.createElement('fieldset')
      fieldset.dataset.reviewCriterion = criterion.id

      const legend = document.createElement('legend')
      legend.textContent = criterion.label
      fieldset.append(legend)

      for (const value of ['pass', 'needs-revision']) {
        const label = document.createElement('label')
        const input = document.createElement('input')
        input.type = 'radio'
        input.name = 'criterion-' + criterion.id
        input.value = value
        label.append(input, ' ' + (value === 'pass' ? 'Pass' : 'Needs revision'))
        fieldset.append(label)
      }
      criteriaRoot.append(fieldset)
    }
  }

  roleSelect.addEventListener('change', render)
  render()
}

function createHumanReviewRecord(template) {
  const role = document.querySelector('[data-human-review-role]').value
  const reviewerName = document.querySelector('[data-human-review-name]').value.trim()
  const notes = document.querySelector('[data-human-review-notes]').value.trim()

  if (!template.allowedRoles.includes(role)) throw new Error('Select an authorized human review role.')
  if (!reviewerName) throw new Error('Reviewer name is required before a review record can be generated.')

  const criteria = clone(template.criteria[role])
  for (const criterion of criteria) {
    const selected = document.querySelector('input[name="criterion-' + criterion.id + '"]:checked')
    if (!selected) throw new Error('Complete every review criterion before generating a record.')
    criterion.decision = selected.value
  }

  const overallDecision = criteria.every((criterion) => criterion.decision === 'pass')
    ? 'pass'
    : 'needs-revision'

  return {
    schemaVersion: template.schemaVersion,
    artifactType: 'animation-human-review-record',
    animationId: template.animationId,
    status: 'human-review-recorded',
    reviewRole: role,
    reviewerName,
    recordedAt: new Date().toISOString(),
    overallDecision,
    criteria,
    notes,
    governance: clone(template.governance),
  }
}

async function initializeReviewHarness() {
  const container = document.getElementById('starting-system-review-player')
  const [manifest, reviewTemplate] = await Promise.all([
    loadJson(MANIFEST_URL),
    loadJson(REVIEW_TEMPLATE_URL),
  ])

  if (manifest.governance?.publicationAllowed !== false ||
      manifest.governance?.humanApprovalRecorded !== false ||
      manifest.governance?.assessmentEligible !== false ||
      manifest.governance?.scoredAssessmentApproved !== false) {
    throw new Error('Review harness refuses manifests that cross the review-only governance boundary.')
  }

  if (reviewTemplate.governance?.publicationEffect !== 'none' ||
      reviewTemplate.governance?.assessmentEffect !== 'none' ||
      reviewTemplate.governance?.finalApprovalEffect !== 'none' ||
      reviewTemplate.governance?.agentMayCompleteReview !== false ||
      reviewTemplate.governance?.agentMayApprove !== false ||
      reviewTemplate.governance?.agentMayRelease !== false) {
    throw new Error('Human review template violates the review-only governance boundary.')
  }

  setText('[data-review-governance]', 'Human approval: not recorded · Publication: denied · Assessment: ineligible')
  setText('[data-review-animation-id]', manifest.animationId)
  setText('[data-review-presentation-mode]', manifest.presentation?.mode || 'unknown')
  setText('[data-review-clip-count]', (manifest.presentation?.clips || []).length)
  setText('[data-review-runtime-clips]', 'loading')
  setText('[data-review-publication]', manifest.governance.publicationAllowed)
  setText('[data-review-assessment]', manifest.governance.assessmentEligible)

  const clipList = document.querySelector('[data-review-clip-list]')
  for (const clip of manifest.presentation?.clips || []) {
    const item = document.createElement('li')
    item.textContent = clip.id + ' → ' + clip.assetClipName + ' (' + clip.durationSeconds + ' s)'
    clipList.append(item)
  }

  renderReviewCriteria(reviewTemplate)

  const reviewStatus = document.querySelector('[data-human-review-status]')
  const reviewOutput = document.querySelector('[data-human-review-output]')
  document.querySelector('[data-human-review-generate]').addEventListener('click', () => {
    try {
      const record = createHumanReviewRecord(reviewTemplate)
      reviewOutput.textContent = JSON.stringify(record, null, 2)
      reviewOutput.hidden = false
      reviewStatus.textContent = 'Local human review record generated. It has no publication, assessment, or final-approval effect.'
      reviewStatus.dataset.reviewDecision = record.overallDecision
    } catch (error) {
      reviewOutput.hidden = true
      reviewStatus.textContent = error.message
      delete reviewStatus.dataset.reviewDecision
    }
  })

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

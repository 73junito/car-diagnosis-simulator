(function(){
  const gapForm = document.getElementById('research-gap-form')
  const lessonSelect = document.getElementById('research-lesson')
  const gapSummaryInput = document.getElementById('research-gap-summary')
  const gapTypeInput = document.getElementById('research-gap-type')
  const gapPriorityInput = document.getElementById('research-gap-priority')
  const gapStatus = document.getElementById('research-gap-status')
  const existingGapSelect = document.getElementById('research-existing-gap')
  const useGapButton = document.getElementById('research-use-gap')
  const reviewStatus = document.getElementById('evidence-review-status')
  const reviewList = document.getElementById('evidence-review-list')
  const form = document.getElementById('research-form')
  const queryInput = document.getElementById('research-query')
  const limitInput = document.getElementById('research-limit')
  const status = document.getElementById('research-status')
  const results = document.getElementById('research-results')
  const enhancementGoal = document.getElementById('enhancement-goal')
  const generateEnhancementDraftButton = document.getElementById('generate-enhancement-draft')
  const enhancementSelectionCount = document.getElementById('enhancement-selection-count')
  const enhancementDraftStatus = document.getElementById('enhancement-draft-status')
  const enhancementDraftList = document.getElementById('enhancement-draft-list')

  const rightsScopeConfig = [
    ['citation_link_allowed', 'Citation / link'],
    ['paraphrase_summary_allowed', 'Paraphrase / summary'],
    ['direct_excerpt_allowed', 'Direct excerpt / reprint'],
    ['figures_tables_diagrams_allowed', 'Figures / tables / diagrams'],
    ['database_storage_allowed', 'Database storage'],
    ['ai_rag_ingestion_allowed', 'AI / RAG ingestion'],
    ['commercial_use_allowed', 'Commercial use']
  ]

  let activeGap = null
  let approvedSources = []
  let existingGaps = []
  const selectedEnhancementEvidenceIds = new Set()

  function accessToken(){
    return typeof window.getAccessToken === 'function' ? window.getAccessToken() : null
  }

  function clearResults(){
    while (results.firstChild) results.removeChild(results.firstChild)
  }

  function text(tag, value, className){
    const el = document.createElement(tag)
    if (className) el.className = className
    el.textContent = value || ''
    return el
  }

  function semanticScholarPublicUrl(rawUrl){
    try {
      const url = new URL(rawUrl, 'https://www.semanticscholar.org/')
      if (url.hostname === 'www.semanticscholar.org' || url.hostname === 'semanticscholar.org') {
        url.searchParams.set('utm_source', 'api')
      }
      return url.toString()
    } catch {
      return rawUrl
    }
  }

  async function apiRequest(url, options = {}){
    const token = accessToken()
    if (!token) throw new Error('AUTH_REQUIRED')

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + token,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.error || 'Request failed.')
      error.status = response.status
      throw error
    }
    return payload
  }

  async function loadCurriculum(){
    try {
      const response = await fetch('/api/curriculum', { headers: { Accept: 'application/json' } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error('Curriculum unavailable')

      const lessons = Array.isArray(payload.lessonPlans) ? payload.lessonPlans : []
      const courses = new Map(
        (Array.isArray(payload.courses) ? payload.courses : []).map((course) => [course.id, course])
      )

      while (lessonSelect.firstChild) lessonSelect.removeChild(lessonSelect.firstChild)
      const blank = document.createElement('option')
      blank.value = ''
      blank.textContent = lessons.length ? 'Select a lesson or module' : 'No curriculum lessons available'
      lessonSelect.appendChild(blank)

      lessons.forEach((lesson) => {
        const option = document.createElement('option')
        option.value = lesson.id
        const course = courses.get(lesson.courseId)
        const courseLabel = course ? course.title : lesson.courseId
        option.textContent = courseLabel + ' — ' + lesson.title
        lessonSelect.appendChild(option)
      })
    } catch (error) {
      lessonSelect.textContent = ''
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'Curriculum unavailable'
      lessonSelect.appendChild(option)
      gapStatus.textContent = 'Curriculum could not be loaded for evidence-gap selection.'
    }
  }

  function clearNode(node){
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  async function loadApprovedSources(){
    if (!accessToken()) {
      approvedSources = []
      return
    }
    try {
      const payload = await apiRequest('/api/research/curriculum-evidence/approved-sources')
      approvedSources = Array.isArray(payload.data) ? payload.data : []
    } catch {
      approvedSources = []
    }
  }

  async function loadExistingGaps(){
    clearNode(existingGapSelect)
    existingGaps = []
    const lessonPlanId = lessonSelect.value

    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = lessonPlanId ? 'Loading existing gaps…' : 'Select a lesson to load existing gaps'
    existingGapSelect.appendChild(blank)

    if (!lessonPlanId || !accessToken()) return

    try {
      const params = new URLSearchParams({ lessonPlanId })
      const payload = await apiRequest('/api/research/curriculum-evidence/gaps?' + params.toString())
      existingGaps = Array.isArray(payload.data) ? payload.data : []

      clearNode(existingGapSelect)
      const option = document.createElement('option')
      option.value = ''
      option.textContent = existingGaps.length ? 'Select an existing gap' : 'No existing gaps for this lesson'
      existingGapSelect.appendChild(option)

      existingGaps.forEach((gap) => {
        const gapOption = document.createElement('option')
        gapOption.value = gap.id
        gapOption.textContent =
          String(gap.priority || 'medium').toUpperCase() + ' · ' +
          String(gap.status || 'identified') + ' · ' +
          String(gap.gap_summary || '').slice(0, 120)
        existingGapSelect.appendChild(gapOption)
      })
    } catch (error) {
      clearNode(existingGapSelect)
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'Existing gaps unavailable'
      existingGapSelect.appendChild(option)
      gapStatus.textContent = error.message || 'Existing evidence gaps could not be loaded.'
    }
  }

  async function activateGap(gap){
    activeGap = gap || null
    selectedEnhancementEvidenceIds.clear()
    updateEnhancementSelectionCount()

    if (!activeGap) {
      gapStatus.textContent = 'No active evidence gap.'
      reviewStatus.textContent = 'Select or create an evidence gap to load saved evidence.'
      enhancementDraftStatus.textContent = 'Select or create an evidence gap to load curriculum enhancement drafts.'
      clearNode(reviewList)
      clearNode(enhancementDraftList)
      return
    }

    gapStatus.textContent =
      'Active gap: ' + activeGap.gap_summary + ' (' + activeGap.status + ').'
    await loadApprovedSources()
    await loadEvidence()
    await loadEnhancementDrafts()
  }

  async function patchEvidence(record, action, body = {}){
    return apiRequest(
      '/api/research/curriculum-evidence/records/' + encodeURIComponent(record.id),
      {
        method: 'PATCH',
        body: JSON.stringify({ action, ...body })
      }
    )
  }

  async function patchRightsScope(sourceId, body){
    return apiRequest(
      '/api/research/curriculum-evidence/approved-sources/' +
        encodeURIComponent(sourceId) + '/rights',
      {
        method: 'PATCH',
        body: JSON.stringify(body)
      }
    )
  }

  function curriculumRightsAllowed(scope){
    if (!scope) return false
    const today = new Date().toISOString().slice(0, 10)
    const current =
      (!scope.effective_at || scope.effective_at <= today) &&
      (!scope.expires_at || scope.expires_at >= today)
    return current &&
      scope.citation_link_allowed === true &&
      scope.paraphrase_summary_allowed === true &&
      scope.database_storage_allowed === true &&
      Boolean(scope.reviewed_by && scope.reviewed_at && scope.license_evidence_reference)
  }

  function aiDraftRightsAllowed(scope){
    return curriculumRightsAllowed(scope) && scope.ai_rag_ingestion_allowed === true
  }

  function selectedEvidenceSource(record){
    return approvedSources.find((source) => source.id === record.approved_source_id) || null
  }

  function updateEnhancementSelectionCount(){
    const count = selectedEnhancementEvidenceIds.size
    enhancementSelectionCount.textContent =
      count + ' eligible evidence record' + (count === 1 ? '' : 's') + ' selected.'
    generateEnhancementDraftButton.disabled = !activeGap || count === 0
  }

  function createActionButton(label, onClick, disabled = false){
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tm-btn tm-btn-secondary'
    button.textContent = label
    button.disabled = disabled
    button.addEventListener('click', onClick)
    return button
  }

  function renderRightsScopeEditor(source, message){
    const scope = source.rights_scope || {}
    const panel = document.createElement('div')
    panel.className = 'tm-card'
    panel.style.marginTop = '.75rem'

    panel.appendChild(text('h4', 'Source rights scope'))
    panel.appendChild(text(
      'p',
      curriculumRightsAllowed(scope)
        ? 'Current human-reviewed curriculum-use rights are sufficient.'
        : 'Rights are incomplete, expired, or not yet reviewed. Approval remains blocked.',
      'fine-print'
    ))

    const fields = new Map()
    rightsScopeConfig.forEach(([key, labelText]) => {
      const label = document.createElement('label')
      label.style.display = 'block'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = scope[key] === true
      input.setAttribute('data-rights-scope', key)
      fields.set(key, input)
      label.appendChild(input)
      label.appendChild(document.createTextNode(' ' + labelText))
      panel.appendChild(label)
    })

    const evidenceLabel = document.createElement('label')
    evidenceLabel.textContent = 'License evidence / permission reference'
    evidenceLabel.style.display = 'block'
    evidenceLabel.style.marginTop = '.75rem'
    const evidenceInput = document.createElement('input')
    evidenceInput.type = 'text'
    evidenceInput.required = true
    evidenceInput.value =
      scope.license_evidence_reference ||
      (source.license && (source.license.license_url || source.license.canonical_url)) ||
      ''
    evidenceInput.setAttribute('aria-label', 'License evidence or permission reference')
    evidenceLabel.appendChild(evidenceInput)
    panel.appendChild(evidenceLabel)

    const effectiveLabel = document.createElement('label')
    effectiveLabel.textContent = 'Effective date'
    effectiveLabel.style.display = 'block'
    const effectiveInput = document.createElement('input')
    effectiveInput.type = 'date'
    effectiveInput.value = scope.effective_at || ''
    effectiveLabel.appendChild(effectiveInput)
    panel.appendChild(effectiveLabel)

    const expiresLabel = document.createElement('label')
    expiresLabel.textContent = 'Expiration date'
    expiresLabel.style.display = 'block'
    const expiresInput = document.createElement('input')
    expiresInput.type = 'date'
    expiresInput.value = scope.expires_at || ''
    expiresLabel.appendChild(expiresInput)
    panel.appendChild(expiresLabel)

    const notesLabel = document.createElement('label')
    notesLabel.textContent = 'Rights review notes'
    notesLabel.style.display = 'block'
    const notesInput = document.createElement('textarea')
    notesInput.rows = 3
    notesInput.value = scope.review_notes || ''
    notesLabel.appendChild(notesInput)
    panel.appendChild(notesLabel)

    const saveButton = createActionButton('Save rights scope', async () => {
      saveButton.disabled = true
      message.textContent = 'Saving human-reviewed rights scope…'
      try {
        const body = {
          license_evidence_reference: evidenceInput.value.trim(),
          effective_at: effectiveInput.value || null,
          expires_at: expiresInput.value || null,
          review_notes: notesInput.value.trim() || null
        }
        rightsScopeConfig.forEach(([key]) => {
          body[key] = fields.get(key).checked
        })

        const payload = await patchRightsScope(source.id, body)
        source.rights_scope = payload.data
        message.textContent = 'Source rights scope recorded.'
        await loadApprovedSources()
        await loadEvidence()
      } catch (error) {
        message.textContent = error.message
        saveButton.disabled = false
      }
    })
    panel.appendChild(saveButton)

    return panel
  }

  function renderEvidenceRecord(record){
    const card = document.createElement('article')
    card.className = 'tm-card'
    card.style.marginBottom = '1rem'

    card.appendChild(text('h3', record.title || 'Untitled evidence'))
    card.appendChild(text(
      'p',
      'Review: ' + record.review_status +
        ' · License: ' + record.license_status +
        ' · Assessment eligibility: none'
    ))

    if (record.doi) card.appendChild(text('p', 'DOI: ' + record.doi))
    if (record.source_url) {
      const link = document.createElement('a')
      link.href = record.source_url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = 'Open source record'
      card.appendChild(link)
    }

    const sourceForDraft = selectedEvidenceSource(record)
    const draftEligible =
      record.review_status === 'approved' &&
      record.license_status === 'verified-for-use' &&
      record.scored_assessment_eligible === false &&
      Boolean(sourceForDraft && aiDraftRightsAllowed(sourceForDraft.rights_scope))

    const draftChoice = document.createElement('label')
    draftChoice.style.display = 'block'
    draftChoice.style.marginTop = '.75rem'
    const draftCheckbox = document.createElement('input')
    draftCheckbox.type = 'checkbox'
    draftCheckbox.checked = selectedEnhancementEvidenceIds.has(record.id)
    draftCheckbox.disabled = !draftEligible
    draftCheckbox.setAttribute('aria-label', 'Use this approved evidence for AI-assisted curriculum drafting')
    draftCheckbox.addEventListener('change', () => {
      if (draftCheckbox.checked) selectedEnhancementEvidenceIds.add(record.id)
      else selectedEnhancementEvidenceIds.delete(record.id)
      updateEnhancementSelectionCount()
    })
    draftChoice.appendChild(draftCheckbox)
    draftChoice.appendChild(document.createTextNode(
      draftEligible
        ? ' Use for AI-assisted curriculum enhancement draft'
        : ' AI drafting unavailable — evidence must be approved and source AI/RAG rights must be explicitly enabled'
    ))
    card.appendChild(draftChoice)

    const message = text('p', 'Human review required before approval.', 'fine-print')
    message.setAttribute('role', 'status')

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.gap = '.5rem'
    actions.style.flexWrap = 'wrap'
    actions.style.marginTop = '.75rem'

    const finalized = record.review_status === 'approved' || record.review_status === 'rejected'

    const reviewButton = createActionButton(
      'Mark reviewed',
      async () => {
        reviewButton.disabled = true
        message.textContent = 'Recording human review…'
        try {
          await patchEvidence(record, 'review')
          message.textContent = 'Human review recorded.'
          await loadEvidence()
        } catch (error) {
          message.textContent = error.message
          reviewButton.disabled = false
        }
      },
      finalized || !['discovered', 'reviewed'].includes(record.review_status)
    )
    actions.appendChild(reviewButton)

    const licenseSelect = document.createElement('select')
    licenseSelect.setAttribute('aria-label', 'License review status')
    ;[
      ['verified-for-use', 'Verified for use'],
      ['restricted', 'Restricted'],
      ['unknown', 'Unknown']
    ].forEach(([value, label]) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      licenseSelect.appendChild(option)
    })
    licenseSelect.disabled = finalized || !record.reviewed_by
    actions.appendChild(licenseSelect)

    const licenseButton = createActionButton(
      'Record license review',
      async () => {
        licenseButton.disabled = true
        message.textContent = 'Recording license review…'
        try {
          await patchEvidence(record, 'license', { licenseStatus: licenseSelect.value })
          message.textContent = 'License review recorded.'
          await loadEvidence()
        } catch (error) {
          message.textContent = error.message
          licenseButton.disabled = false
        }
      },
      finalized || !record.reviewed_by
    )
    actions.appendChild(licenseButton)

    const sourceSelect = document.createElement('select')
    sourceSelect.setAttribute('aria-label', 'Approved provenance source')
    const sourceBlank = document.createElement('option')
    sourceBlank.value = ''
    sourceBlank.textContent = approvedSources.length
      ? 'Select approved provenance source'
      : 'No approved provenance sources available'
    sourceSelect.appendChild(sourceBlank)
    approvedSources.forEach((source) => {
      const option = document.createElement('option')
      option.value = source.id
      option.textContent =
        (source.title || source.id) +
        (curriculumRightsAllowed(source.rights_scope)
          ? ' — rights ready'
          : ' — rights review needed')
      if (record.approved_source_id === source.id) option.selected = true
      sourceSelect.appendChild(option)
    })
    sourceSelect.disabled = finalized || approvedSources.length === 0
    actions.appendChild(sourceSelect)

    const rightsContainer = document.createElement('div')
    rightsContainer.style.width = '100%'
    const renderSelectedRights = () => {
      clearNode(rightsContainer)
      const selectedSource = approvedSources.find((source) => source.id === sourceSelect.value)
      if (selectedSource) {
        rightsContainer.appendChild(renderRightsScopeEditor(selectedSource, message))
      } else {
        rightsContainer.appendChild(text(
          'p',
          'Select an approved provenance source to review its use-specific rights.',
          'fine-print'
        ))
      }
    }
    sourceSelect.addEventListener('change', renderSelectedRights)
    renderSelectedRights()

    const linkButton = createActionButton(
      'Link provenance',
      async () => {
        if (!sourceSelect.value) {
          message.textContent = 'Select an approved provenance source first.'
          return
        }
        linkButton.disabled = true
        message.textContent = 'Linking approved provenance source…'
        try {
          await patchEvidence(record, 'link-source', { approvedSourceId: sourceSelect.value })
          message.textContent = 'Approved provenance source linked.'
          await loadEvidence()
        } catch (error) {
          message.textContent = error.message
          linkButton.disabled = false
        }
      },
      finalized || approvedSources.length === 0
    )
    actions.appendChild(linkButton)

    const approveButton = createActionButton(
      'Approve evidence',
      async () => {
        approveButton.disabled = true
        message.textContent = 'Applying approval gate…'
        try {
          await patchEvidence(record, 'approve')
          message.textContent = 'Evidence approved for curriculum use. Assessment eligibility remains none.'
          await loadEvidence()
        } catch (error) {
          message.textContent = error.message
          approveButton.disabled = false
        }
      },
      finalized ||
        record.review_status !== 'license-verified' ||
        !record.approved_source_id ||
        !curriculumRightsAllowed(
          approvedSources.find((source) => source.id === record.approved_source_id)?.rights_scope
        )
    )
    actions.appendChild(approveButton)

    const rejectButton = createActionButton(
      'Reject evidence',
      async () => {
        rejectButton.disabled = true
        message.textContent = 'Rejecting evidence…'
        try {
          await patchEvidence(record, 'reject')
          message.textContent = 'Evidence rejected.'
          await loadEvidence()
        } catch (error) {
          message.textContent = error.message
          rejectButton.disabled = false
        }
      },
      finalized
    )
    actions.appendChild(rejectButton)

    card.appendChild(actions)
    card.appendChild(rightsContainer)
    card.appendChild(message)
    return card
  }

  async function loadEvidence(){
    clearNode(reviewList)
    if (!activeGap) {
      reviewStatus.textContent = 'Select or create an evidence gap to load saved evidence.'
      return
    }

    reviewStatus.textContent = 'Loading saved evidence…'
    try {
      const params = new URLSearchParams({ gapId: activeGap.id })
      const payload = await apiRequest('/api/research/curriculum-evidence/records?' + params.toString())
      const records = Array.isArray(payload.data) ? payload.data : []
      reviewStatus.textContent = records.length
        ? 'Showing ' + records.length + ' saved evidence record' + (records.length === 1 ? '.' : 's.')
        : 'No saved evidence for this gap yet.'
      records.forEach((record) => reviewList.appendChild(renderEvidenceRecord(record)))
    } catch (error) {
      reviewStatus.textContent = error.message || 'Saved evidence could not be loaded.'
    }
  }

  async function patchEnhancementDraft(draftId, action){
    return apiRequest(
      '/api/research/curriculum-enhancements/drafts/' + encodeURIComponent(draftId),
      {
        method: 'PATCH',
        body: JSON.stringify({ action })
      }
    )
  }

  function appendStringList(card, heading, values){
    if (!Array.isArray(values) || !values.length) return
    card.appendChild(text('h4', heading))
    const list = document.createElement('ul')
    values.forEach((value) => list.appendChild(text('li', value)))
    card.appendChild(list)
  }

  function renderEnhancementDraft(draft){
    const card = document.createElement('article')
    card.className = 'tm-card'
    card.style.marginBottom = '1rem'

    const payload = draft.draft_payload || {}
    card.appendChild(text('h3', payload.summary || 'Curriculum enhancement draft'))
    card.appendChild(text(
      'p',
      'Status: ' + draft.status +
        ' · Publication: draft only' +
        ' · Assessment generation: not allowed' +
        ' · Assessment eligibility: none',
      'fine-print'
    ))

    if (payload.rationale) {
      card.appendChild(text('h4', 'Rationale'))
      card.appendChild(text('p', payload.rationale))
    }
    appendStringList(card, 'Proposed objectives', payload.proposed_objectives)
    appendStringList(card, 'Proposed lesson steps', payload.proposed_steps)
    appendStringList(card, 'Safety notes', payload.safety_notes)

    if (Array.isArray(payload.source_notes) && payload.source_notes.length) {
      card.appendChild(text('h4', 'Evidence use notes'))
      const list = document.createElement('ul')
      payload.source_notes.forEach((note) => {
        list.appendChild(text(
          'li',
          String(note.evidenceId || 'Evidence') + ': ' + String(note.use || '')
        ))
      })
      card.appendChild(list)
    }

    const message = text(
      'p',
      'Instructor review is required. This draft cannot publish curriculum or create assessment items.',
      'fine-print'
    )
    message.setAttribute('role', 'status')

    if (draft.status === 'draft') {
      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.gap = '.5rem'
      actions.style.flexWrap = 'wrap'

      const reviewButton = createActionButton('Mark draft reviewed', async () => {
        reviewButton.disabled = true
        message.textContent = 'Recording instructor review…'
        try {
          await patchEnhancementDraft(draft.id, 'review')
          message.textContent = 'Draft marked reviewed. Publication remains unavailable.'
          await loadEnhancementDrafts()
        } catch (error) {
          message.textContent = error.message
          reviewButton.disabled = false
        }
      })

      const rejectButton = createActionButton('Reject draft', async () => {
        rejectButton.disabled = true
        message.textContent = 'Rejecting draft…'
        try {
          await patchEnhancementDraft(draft.id, 'reject')
          message.textContent = 'Draft rejected.'
          await loadEnhancementDrafts()
        } catch (error) {
          message.textContent = error.message
          rejectButton.disabled = false
        }
      })

      actions.appendChild(reviewButton)
      actions.appendChild(rejectButton)
      card.appendChild(actions)
    }

    card.appendChild(message)
    return card
  }

  async function loadEnhancementDrafts(){
    clearNode(enhancementDraftList)
    if (!activeGap) {
      enhancementDraftStatus.textContent = 'Select or create an evidence gap to load curriculum enhancement drafts.'
      return
    }

    enhancementDraftStatus.textContent = 'Loading curriculum enhancement drafts…'
    try {
      const params = new URLSearchParams({ lessonPlanId: activeGap.lesson_plan_id })
      const payload = await apiRequest(
        '/api/research/curriculum-enhancements/drafts?' + params.toString()
      )
      const drafts = Array.isArray(payload.data) ? payload.data : []
      enhancementDraftStatus.textContent = drafts.length
        ? 'Showing ' + drafts.length + ' instructor-review draft' + (drafts.length === 1 ? '.' : 's.')
        : 'No AI-assisted curriculum enhancement drafts exist for this lesson.'
      drafts.forEach((draft) => enhancementDraftList.appendChild(renderEnhancementDraft(draft)))
    } catch (error) {
      enhancementDraftStatus.textContent =
        error.message || 'Curriculum enhancement drafts could not be loaded.'
    }
  }

  async function generateEnhancementDraft(){
    if (!activeGap) {
      enhancementDraftStatus.textContent = 'Select or create an evidence gap first.'
      return
    }

    const goal = String(enhancementGoal.value || '').trim()
    if (goal.length < 10) {
      enhancementDraftStatus.textContent = 'Enter an enhancement goal of at least 10 characters.'
      return
    }

    const evidenceIds = [...selectedEnhancementEvidenceIds]
    if (!evidenceIds.length) {
      enhancementDraftStatus.textContent = 'Select at least one AI-eligible approved evidence record.'
      return
    }

    generateEnhancementDraftButton.disabled = true
    enhancementDraftStatus.textContent =
      'Generating an instructor-review draft from rights-cleared evidence…'
    try {
      await apiRequest('/api/research/curriculum-enhancements/drafts', {
        method: 'POST',
        body: JSON.stringify({
          lessonPlanId: activeGap.lesson_plan_id,
          evidenceIds,
          goal
        })
      })
      enhancementDraftStatus.textContent =
        'Draft generated. Human review is required; publication and assessment generation remain unavailable.'
      selectedEnhancementEvidenceIds.clear()
      updateEnhancementSelectionCount()
      await loadEvidence()
      await loadEnhancementDrafts()
    } catch (error) {
      enhancementDraftStatus.textContent = error.message
    } finally {
      updateEnhancementSelectionCount()
    }
  }

  async function createGap(event){
    event.preventDefault()
    if (!accessToken()) {
      gapStatus.textContent = 'Sign in with an authorized instructor or administrator account to create a gap.'
      return
    }

    gapStatus.textContent = 'Creating evidence gap…'
    try {
      const payload = await apiRequest('/api/research/curriculum-evidence/gaps', {
        method: 'POST',
        body: JSON.stringify({
          lessonPlanId: lessonSelect.value,
          gapSummary: gapSummaryInput.value.trim(),
          gapType: gapTypeInput.value,
          priority: gapPriorityInput.value
        })
      })

      await activateGap(payload.data)
      await loadExistingGaps()
      gapStatus.textContent =
        'Active gap created for ' + activeGap.lesson_plan_id + '. Search, save, and review evidence below.'
    } catch (error) {
      gapStatus.textContent =
        error.message === 'AUTH_REQUIRED' ? 'Authentication required.' : error.message
    }
  }

  async function saveEvidence(paper, button, message){
    if (!activeGap) {
      message.textContent = 'Create an evidence gap before saving research.'
      return
    }

    button.disabled = true
    message.textContent = 'Saving as unreviewed curriculum evidence…'

    try {
      const doi = paper.externalIds && paper.externalIds.DOI
      await apiRequest('/api/research/curriculum-evidence/records', {
        method: 'POST',
        body: JSON.stringify({
          gapId: activeGap.id,
          providerRecordId: paper.paperId,
          title: paper.title,
          authors: Array.isArray(paper.authors) ? paper.authors : [],
          publicationYear: paper.year,
          venue: paper.venue,
          doi,
          sourceUrl: semanticScholarPublicUrl(paper.url),
          abstract: paper.abstract,
          citationCount: paper.citationCount,
          providerMetadata: {
            publicationDate: paper.publicationDate || null,
            publicationTypes: Array.isArray(paper.publicationTypes) ? paper.publicationTypes : []
          }
        })
      })

      message.textContent =
        'Saved as discovered evidence. Human review and license verification are still required.'
      button.textContent = 'Saved'
      await loadEvidence()
    } catch (error) {
      message.textContent = error.message
      if (error.status !== 409) button.disabled = false
    }
  }

  function renderPaper(paper){
    const card = document.createElement('article')
    card.className = 'tm-card'
    card.style.marginBottom = '1rem'

    card.appendChild(text('h3', paper.title || 'Untitled paper'))

    const authors = Array.isArray(paper.authors)
      ? paper.authors.map((author) => author && author.name).filter(Boolean).join(', ')
      : ''
    if (authors) card.appendChild(text('p', authors))

    const metaParts = []
    if (paper.year) metaParts.push(String(paper.year))
    if (paper.venue) metaParts.push(paper.venue)
    if (paper.citationCount != null) metaParts.push(String(paper.citationCount) + ' citations')
    if (metaParts.length) card.appendChild(text('p', metaParts.join(' · ')))

    const doi = paper.externalIds && paper.externalIds.DOI
    if (doi) card.appendChild(text('p', 'DOI: ' + doi))

    if (paper.abstract) {
      const details = document.createElement('details')
      details.appendChild(text('summary', 'Abstract'))
      details.appendChild(text('p', paper.abstract))
      card.appendChild(details)
    }

    if (paper.url) {
      const link = document.createElement('a')
      link.href = semanticScholarPublicUrl(paper.url)
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = 'View on Semantic Scholar'
      card.appendChild(link)
    }

    const actions = document.createElement('div')
    actions.style.marginTop = '.75rem'
    const saveButton = document.createElement('button')
    saveButton.type = 'button'
    saveButton.className = 'tm-btn tm-btn-secondary'
    saveButton.textContent = 'Save as Curriculum Evidence'
    saveButton.disabled = !activeGap || !paper.paperId
    const saveStatus = text('p', activeGap
      ? 'Save to the active evidence gap.'
      : 'Create an evidence gap to enable saving.', 'fine-print')
    saveStatus.setAttribute('role', 'status')
    saveButton.addEventListener('click', () => saveEvidence(paper, saveButton, saveStatus))
    actions.appendChild(saveButton)
    actions.appendChild(saveStatus)
    card.appendChild(actions)

    const boundary = text(
      'p',
      'Unreviewed discovery metadata — human provenance review required before curriculum use; no scored-assessment eligibility.'
    )

    boundary.className = 'fine-print'
    card.appendChild(boundary)

    return card
  }

  async function search(event){
    event.preventDefault()
    clearResults()

    const query = String(queryInput.value || '').trim()
    if (query.length < 3) {
      status.textContent = 'Enter at least 3 characters.'
      return
    }

    if (!accessToken()) {
      status.textContent = 'Sign in with an authorized instructor or administrator account to search research.'
      return
    }

    status.textContent = 'Searching Semantic Scholar…'

    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(limitInput.value || '5')
      })
      const payload = await apiRequest('/api/research/semantic-scholar/search?' + params.toString())

      const papers = Array.isArray(payload.data) ? payload.data : []
      status.textContent = papers.length
        ? 'Showing ' + papers.length + ' unreviewed research results.'
        : 'No matching papers were returned.'

      papers.forEach((paper) => results.appendChild(renderPaper(paper)))
    } catch (error) {
      status.textContent = error.message === 'AUTH_REQUIRED'
        ? 'Authentication required.'
        : error.message || 'Research service is temporarily unavailable.'
    }
  }

  lessonSelect.addEventListener('change', async () => {
    await activateGap(null)
    await loadExistingGaps()
  })

  useGapButton.addEventListener('click', async () => {
    const selected = existingGaps.find((gap) => gap.id === existingGapSelect.value)
    if (!selected) {
      gapStatus.textContent = 'Select an existing evidence gap first.'
      return
    }
    await activateGap(selected)
  })

  gapForm.addEventListener('submit', createGap)
  form.addEventListener('submit', search)
  generateEnhancementDraftButton.addEventListener('click', generateEnhancementDraft)
  updateEnhancementSelectionCount()
  loadCurriculum()
})()

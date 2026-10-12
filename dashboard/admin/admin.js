(function(){
  const queue = document.getElementById('verification-queue')
  const status = document.getElementById('admin-status')
  const queueStatus = document.getElementById('queue-status')
  const refresh = document.getElementById('refresh-queue')
  const authorQueue = document.getElementById('author-review-queue')
  const authorStatus = document.getElementById('author-review-status')
  const authorStatusSelect = document.getElementById('author-review-status-select')
  const authorRefresh = document.getElementById('author-review-refresh')
  const publicationQueue = document.getElementById('author-publication-queue')
  const publicationStatus = document.getElementById('author-publication-status')
  const publicationStatusSelect = document.getElementById('author-publication-status-select')
  const publicationRefresh = document.getElementById('author-publication-refresh')

  function token(){ return typeof window.getAccessToken === 'function' ? window.getAccessToken() : null }
  function clear(node){ while(node.firstChild) node.removeChild(node.firstChild) }
  function text(tag, value, className){ const el=document.createElement(tag); if(className) el.className=className; el.textContent=value || ''; return el }

  async function api(url, options = {}){
    const accessToken = token()
    if (!accessToken) throw new Error('Sign in with an administrator account to continue.')
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Request failed.')
    return payload
  }

  function displayInstitution(request){
    const institution = request.institution || {}
    const place = [institution.city, institution.stateCode || institution.country].filter(Boolean).join(', ')
    return [institution.schoolName || request.schoolCode, place].filter(Boolean).join(' — ')
  }

  async function decide(request, decision, note, card){
    const confirmed = window.confirm(decision === 'approved'
      ? 'Approve this instructor affiliation request? This does not grant an instructor role.'
      : 'Reject this instructor affiliation request?')
    if (!confirmed) return

    card.querySelectorAll('button').forEach((button) => { button.disabled = true })
    status.textContent = 'Saving decision…'
    try {
      await api('/api/admin/instructor-verification/requests/' + encodeURIComponent(request.id), {
        method: 'PATCH',
        body: JSON.stringify({ decision, reviewNote: note })
      })
      status.textContent = 'Decision saved and audit evidence recorded.'
      await loadQueue()
    } catch (error) {
      status.textContent = error.message || 'Decision could not be saved.'
      card.querySelectorAll('button').forEach((button) => { button.disabled = false })
    }
  }

  function renderRequest(request){
    const card = text('article', '', 'admin-card')
    card.appendChild(text('h3', displayInstitution(request)))

    const meta = text('div', '', 'admin-meta')
    meta.appendChild(text('div', 'Applicant user ID: ' + request.userId))
    meta.appendChild(text('div', 'School code: ' + request.schoolCode))
    meta.appendChild(text('div', 'Requested: ' + new Date(request.requestedAt).toLocaleString()))
    meta.appendChild(text('div', 'Status: ' + request.status))
    if (request.reviewedAt) meta.appendChild(text('div', 'Reviewed: ' + new Date(request.reviewedAt).toLocaleString()))
    if (request.reviewedBy) meta.appendChild(text('div', 'Reviewer user ID: ' + request.reviewedBy))
    card.appendChild(meta)

    if (request.reviewNote) card.appendChild(text('p', 'Review note: ' + request.reviewNote))

    if (request.status === 'pending') {
      const actions = text('div', '', 'admin-actions')
      const label = text('label', 'Review note')
      const note = document.createElement('textarea')
      note.className = 'tm-textarea'
      note.maxLength = 1000
      note.placeholder = 'Required for rejection; optional for approval.'
      label.appendChild(note)
      actions.appendChild(label)

      const row = text('div', '', 'admin-action-row')
      const approve = text('button', 'Approve', 'tm-btn tm-btn-primary')
      approve.type = 'button'
      approve.addEventListener('click', () => decide(request, 'approved', note.value.trim(), card))
      const reject = text('button', 'Reject', 'tm-btn tm-btn-secondary')
      reject.type = 'button'
      reject.addEventListener('click', () => {
        const value = note.value.trim()
        if (!value) { status.textContent = 'A review note is required for rejection.'; note.focus(); return }
        decide(request, 'rejected', value, card)
      })
      row.append(approve, reject)
      actions.appendChild(row)
      card.appendChild(actions)
    }

    return card
  }

  async function loadQueue(){
    clear(queue)
    status.textContent = 'Loading ' + queueStatus.value + ' requests…'
    try {
      const payload = await api('/api/admin/instructor-verification/requests?status=' + encodeURIComponent(queueStatus.value))
      const requests = Array.isArray(payload.requests) ? payload.requests : []
      if (!requests.length) {
        queue.appendChild(text('p', 'No ' + queueStatus.value + ' instructor verification requests.', 'admin-empty'))
      } else {
        requests.forEach((request) => queue.appendChild(renderRequest(request)))
      }
      status.textContent = requests.length + ' ' + queueStatus.value + ' request' + (requests.length === 1 ? '' : 's') + '.'
    } catch (error) {
      queue.appendChild(text('p', error.message || 'Queue unavailable.', 'admin-empty'))
      status.textContent = error.message || 'Queue unavailable.'
    }
  }

  async function decideAuthorDraft(draft, decision, note, card){
    const confirmed = window.confirm(decision === 'review_complete'
      ? 'Mark this private draft review complete? This does not publish the scenario.'
      : 'Request changes to this private draft?')
    if (!confirmed) return

    card.querySelectorAll('button').forEach((button) => { button.disabled = true })
    authorStatus.textContent = 'Saving authoring review decision…'
    try {
      await api('/api/admin/author-drafts/reviews/' + encodeURIComponent(draft.id), {
        method: 'PATCH',
        body: JSON.stringify({ decision, reviewNote: note })
      })
      authorStatus.textContent = 'Authoring review decision saved and audit evidence recorded.'
      await loadAuthorQueue()
    } catch (error) {
      authorStatus.textContent = error.message || 'Authoring review decision could not be saved.'
      card.querySelectorAll('button').forEach((button) => { button.disabled = false })
    }
  }

  function renderAuthorDraft(draft){
    const card = text('article', '', 'admin-card')
    card.appendChild(text('h3', draft.title || 'Untitled Scenario'))

    const meta = text('div', '', 'admin-meta')
    meta.appendChild(text('div', 'Author user ID: ' + draft.ownerId))
    meta.appendChild(text('div', 'Scenario key: ' + draft.scenarioKey))
    meta.appendChild(text('div', 'Version: ' + draft.version))
    meta.appendChild(text('div', 'Review status: ' + draft.reviewStatus))
    if (draft.reviewRequestedAt) meta.appendChild(text('div', 'Requested: ' + new Date(draft.reviewRequestedAt).toLocaleString()))
    if (draft.reviewedAt) meta.appendChild(text('div', 'Reviewed: ' + new Date(draft.reviewedAt).toLocaleString()))
    if (draft.reviewedBy) meta.appendChild(text('div', 'Reviewer user ID: ' + draft.reviewedBy))
    card.appendChild(meta)

    if (draft.reviewNote) card.appendChild(text('p', 'Review note: ' + draft.reviewNote))

    if (draft.scenario) {
      const details = document.createElement('details')
      details.appendChild(text('summary', 'Review scenario draft'))
      const preview = document.createElement('pre')
      preview.textContent = JSON.stringify(draft.scenario, null, 2)
      details.appendChild(preview)
      card.appendChild(details)
    }

    if (draft.reviewStatus === 'pending') {
      const actions = text('div', '', 'admin-actions')
      const label = text('label', 'Review note')
      const note = document.createElement('textarea')
      note.className = 'tm-textarea'
      note.maxLength = 2000
      note.placeholder = 'Required when requesting changes; optional when completing review.'
      label.appendChild(note)
      actions.appendChild(label)

      const row = text('div', '', 'admin-action-row')
      const complete = text('button', 'Complete Review', 'tm-btn tm-btn-primary')
      complete.type = 'button'
      complete.addEventListener('click', () => decideAuthorDraft(draft, 'review_complete', note.value.trim(), card))
      const changes = text('button', 'Request Changes', 'tm-btn tm-btn-secondary')
      changes.type = 'button'
      changes.addEventListener('click', () => {
        const value = note.value.trim()
        if (!value) { authorStatus.textContent = 'A review note is required when requesting changes.'; note.focus(); return }
        decideAuthorDraft(draft, 'changes_requested', value, card)
      })
      row.append(complete, changes)
      actions.appendChild(row)
      card.appendChild(actions)
    }

    return card
  }

  async function loadAuthorQueue(){
    clear(authorQueue)
    authorStatus.textContent = 'Loading ' + authorStatusSelect.value.replaceAll('_', ' ') + ' drafts…'
    try {
      const payload = await api('/api/admin/author-drafts/reviews?status=' + encodeURIComponent(authorStatusSelect.value))
      const drafts = Array.isArray(payload.drafts) ? payload.drafts : []
      if (!drafts.length) {
        authorQueue.appendChild(text('p', 'No ' + authorStatusSelect.value.replaceAll('_', ' ') + ' authoring drafts.', 'admin-empty'))
      } else {
        drafts.forEach((draft) => authorQueue.appendChild(renderAuthorDraft(draft)))
      }
      authorStatus.textContent = drafts.length + ' draft' + (drafts.length === 1 ? '' : 's') + '.'
    } catch (error) {
      authorQueue.appendChild(text('p', error.message || 'Authoring review queue unavailable.', 'admin-empty'))
      authorStatus.textContent = error.message || 'Authoring review queue unavailable.'
    }
  }

  async function decidePublication(draft, decision, note, card){
    const confirmed = window.confirm(decision === 'published'
      ? 'Approve publication for this reviewed scenario? This does not grant learner delivery, scoring, or assessment eligibility.'
      : 'Request publication changes and reopen draft review?')
    if (!confirmed) return

    card.querySelectorAll('button').forEach((button) => { button.disabled = true })
    publicationStatus.textContent = 'Saving publication decision…'
    try {
      await api('/api/admin/author-drafts/publications/' + encodeURIComponent(draft.id), {
        method: 'PATCH',
        body: JSON.stringify({ decision, publicationNote: note })
      })
      publicationStatus.textContent = 'Publication decision saved and audit evidence recorded.'
      await loadPublicationQueue()
      await loadAuthorQueue()
    } catch (error) {
      publicationStatus.textContent = error.message || 'Publication decision could not be saved.'
      card.querySelectorAll('button').forEach((button) => { button.disabled = false })
    }
  }

  function renderPublicationDraft(draft){
    const card = text('article', '', 'admin-card')
    card.appendChild(text('h3', draft.title || 'Untitled Scenario'))

    const meta = text('div', '', 'admin-meta')
    meta.appendChild(text('div', 'Author user ID: ' + draft.ownerId))
    meta.appendChild(text('div', 'Scenario key: ' + draft.scenarioKey))
    meta.appendChild(text('div', 'Version: ' + draft.version))
    meta.appendChild(text('div', 'Review status: ' + draft.reviewStatus))
    meta.appendChild(text('div', 'Publication status: ' + draft.publicationStatus))
    if (draft.publicationRequestedAt) meta.appendChild(text('div', 'Publication requested: ' + new Date(draft.publicationRequestedAt).toLocaleString()))
    if (draft.publishedAt) meta.appendChild(text('div', 'Published: ' + new Date(draft.publishedAt).toLocaleString()))
    if (draft.publishedBy) meta.appendChild(text('div', 'Publication reviewer user ID: ' + draft.publishedBy))
    card.appendChild(meta)

    if (draft.publicationNote) card.appendChild(text('p', 'Publication note: ' + draft.publicationNote))

    if (draft.scenario) {
      const details = document.createElement('details')
      details.appendChild(text('summary', 'Review publication candidate'))
      const preview = document.createElement('pre')
      preview.textContent = JSON.stringify(draft.scenario, null, 2)
      details.appendChild(preview)
      card.appendChild(details)
    }

    if (draft.publicationStatus === 'pending') {
      const actions = text('div', '', 'admin-actions')
      const label = text('label', 'Publication note')
      const note = document.createElement('textarea')
      note.className = 'tm-textarea'
      note.maxLength = 2000
      note.placeholder = 'Required when requesting changes; optional when approving publication.'
      label.appendChild(note)
      actions.appendChild(label)

      const row = text('div', '', 'admin-action-row')
      const publish = text('button', 'Approve Publication', 'tm-btn tm-btn-primary')
      publish.type = 'button'
      publish.addEventListener('click', () => decidePublication(draft, 'published', note.value.trim(), card))

      const changes = text('button', 'Request Publication Changes', 'tm-btn tm-btn-secondary')
      changes.type = 'button'
      changes.addEventListener('click', () => {
        const value = note.value.trim()
        if (!value) {
          publicationStatus.textContent = 'A publication note is required when requesting changes.'
          note.focus()
          return
        }
        decidePublication(draft, 'changes_requested', value, card)
      })

      row.append(publish, changes)
      actions.appendChild(row)
      card.appendChild(actions)
    }

    return card
  }

  async function loadPublicationQueue(){
    clear(publicationQueue)
    publicationStatus.textContent = 'Loading ' + publicationStatusSelect.value.replaceAll('_', ' ') + ' publication requests…'
    try {
      const payload = await api('/api/admin/author-drafts/publications?status=' + encodeURIComponent(publicationStatusSelect.value))
      const drafts = Array.isArray(payload.drafts) ? payload.drafts : []
      if (!drafts.length) {
        publicationQueue.appendChild(text('p', 'No ' + publicationStatusSelect.value.replaceAll('_', ' ') + ' publication requests.', 'admin-empty'))
      } else {
        drafts.forEach((draft) => publicationQueue.appendChild(renderPublicationDraft(draft)))
      }
      publicationStatus.textContent = drafts.length + ' publication request' + (drafts.length === 1 ? '' : 's') + '.'
    } catch (error) {
      publicationQueue.appendChild(text('p', error.message || 'Publication queue unavailable.', 'admin-empty'))
      publicationStatus.textContent = error.message || 'Publication queue unavailable.'
    }
  }

  queueStatus.addEventListener('change', loadQueue)
  refresh.addEventListener('click', loadQueue)
  authorStatusSelect.addEventListener('change', loadAuthorQueue)
  authorRefresh.addEventListener('click', loadAuthorQueue)
  publicationStatusSelect.addEventListener('change', loadPublicationQueue)
  publicationRefresh.addEventListener('click', loadPublicationQueue)
  loadQueue()
  loadAuthorQueue()
  loadPublicationQueue()
})()

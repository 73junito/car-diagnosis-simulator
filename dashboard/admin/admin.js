(function(){
  const queue = document.getElementById('verification-queue')
  const status = document.getElementById('admin-status')
  const queueStatus = document.getElementById('queue-status')
  const refresh = document.getElementById('refresh-queue')

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

  queueStatus.addEventListener('change', loadQueue)
  refresh.addEventListener('click', loadQueue)
  loadQueue()
})()

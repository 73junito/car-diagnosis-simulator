(function(){
  const gapForm = document.getElementById('research-gap-form')
  const lessonSelect = document.getElementById('research-lesson')
  const gapSummaryInput = document.getElementById('research-gap-summary')
  const gapTypeInput = document.getElementById('research-gap-type')
  const gapPriorityInput = document.getElementById('research-gap-priority')
  const gapStatus = document.getElementById('research-gap-status')
  const form = document.getElementById('research-form')
  const queryInput = document.getElementById('research-query')
  const limitInput = document.getElementById('research-limit')
  const status = document.getElementById('research-status')
  const results = document.getElementById('research-results')

  let activeGap = null

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

      activeGap = payload.data
      gapStatus.textContent =
        'Active gap created for ' + activeGap.lesson_plan_id + '. Search and save evidence below.'
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
          sourceUrl: paper.url,
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
      link.href = paper.url
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

  gapForm.addEventListener('submit', createGap)
  form.addEventListener('submit', search)
  loadCurriculum()
})()

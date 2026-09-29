(function(){
  const form = document.getElementById('research-form')
  const queryInput = document.getElementById('research-query')
  const limitInput = document.getElementById('research-limit')
  const status = document.getElementById('research-status')
  const results = document.getElementById('research-results')

  function clearResults(){
    while (results.firstChild) results.removeChild(results.firstChild)
  }

  function text(tag, value, className){
    const el = document.createElement(tag)
    if (className) el.className = className
    el.textContent = value || ''
    return el
  }

  function renderPaper(paper){
    const card = document.createElement('article')
    card.className = 'tm-card'
    card.style.marginBottom = '1rem'

    const title = text('h3', paper.title || 'Untitled paper')
    card.appendChild(title)

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
      const summary = text('summary', 'Abstract')
      const abstract = text('p', paper.abstract)
      details.appendChild(summary)
      details.appendChild(abstract)
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

    const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null
    if (!token) {
      status.textContent = 'Sign in with an authorized instructor or administrator account to search research.'
      return
    }

    status.textContent = 'Searching Semantic Scholar…'

    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(limitInput.value || '5')
      })
      const response = await fetch('/api/research/semantic-scholar/search?' + params.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token
        }
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        status.textContent = payload.error || 'Research search failed.'
        return
      }

      const papers = Array.isArray(payload.data) ? payload.data : []
      status.textContent = papers.length
        ? 'Showing ' + papers.length + ' unreviewed research results.'
        : 'No matching papers were returned.'

      papers.forEach((paper) => results.appendChild(renderPaper(paper)))
    } catch (error) {
      status.textContent = 'Research service is temporarily unavailable.'
    }
  }

  form.addEventListener('submit', search)
})()

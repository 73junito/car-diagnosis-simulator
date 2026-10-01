(function () {
  const credentialStep = document.getElementById('credentialStep')
  const schoolStep = document.getElementById('schoolStep')
  const signInForm = document.getElementById('instructorSignIn')
  const schoolForm = document.getElementById('schoolLookup')
  const resultBox = document.getElementById('institutionResult')
  const status = document.getElementById('status')
  let matchedInstitution = null

  function token() {
    return window.getAccessToken ? window.getAccessToken() : null
  }

  function setStatus(message, type) {
    status.textContent = message
    status.className = 'status ' + (type || '')
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', 'Bearer ' + token())
    if (options.body) headers.set('Content-Type', 'application/json')
    return fetch(path, { ...options, headers })
  }

  async function loadStatus() {
    const response = await api('/api/instructor/verification/status')
    if (!response.ok) return false
    const body = await response.json()
    if (body.authorizationGranted) {
      setStatus('Instructor affiliation verified. Opening instructor workspace…', 'success')
      window.location.assign('/dashboard/instructor/')
      return true
    }
    if (body.verification?.status === 'pending') {
      credentialStep.classList.add('hidden')
      schoolStep.classList.add('hidden')
      const school = body.institution?.schoolName || body.verification.school_code
      setStatus('Verification pending for ' + school + '. Instructor access has not been granted.', '')
      return true
    }
    return false
  }

  signInForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = document.getElementById('signInButton')
    button.disabled = true
    setStatus('Signing in…', '')

    const login = await window.supabaseSignIn(
      signInForm.email.value.trim(),
      signInForm.password.value
    )

    if (!login?.access_token) {
      setStatus(login?.error_description || login?.error || 'Sign-in failed', 'error')
      button.disabled = false
      return
    }

    if (await loadStatus()) return

    credentialStep.classList.add('hidden')
    schoolStep.classList.remove('hidden')
    setStatus('Account authenticated. Verify your institution to continue.', 'success')
  })

  schoolForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    matchedInstitution = null
    resultBox.classList.add('hidden')
    const code = schoolForm.schoolCode.value.trim().toUpperCase()

    const response = await api(
      '/api/instructor/verification/institution?school_code=' + encodeURIComponent(code)
    )
    const body = await response.json()

    if (!response.ok) {
      setStatus(body.error || 'School code not recognized', 'error')
      return
    }

    matchedInstitution = body.institution
    resultBox.innerHTML = ''
    const heading = document.createElement('strong')
    heading.textContent = matchedInstitution.schoolName
    const place = document.createElement('p')
    place.textContent = [
      matchedInstitution.city,
      matchedInstitution.stateCode,
      matchedInstitution.country && matchedInstitution.country !== 'N/A'
        ? matchedInstitution.country
        : null
    ].filter(Boolean).join(', ')

    const actions = document.createElement('div')
    actions.className = 'actions'
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.textContent = 'This is my institution'
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.className = 'secondary'
    retry.textContent = 'Use another code'

    actions.append(confirm, retry)
    resultBox.append(heading, place, actions)
    resultBox.classList.remove('hidden')
    setStatus('Confirm the matched institution before submitting for affiliation review.', '')

    retry.addEventListener('click', () => {
      matchedInstitution = null
      resultBox.classList.add('hidden')
      schoolForm.schoolCode.focus()
    })

    confirm.addEventListener('click', async () => {
      confirm.disabled = true
      const submit = await api('/api/instructor/verification/request', {
        method: 'POST',
        body: JSON.stringify({ schoolCode: matchedInstitution.schoolCode })
      })
      const submitBody = await submit.json()

      if (!submit.ok) {
        setStatus(submitBody.error || 'Unable to submit verification request', 'error')
        confirm.disabled = false
        return
      }

      schoolStep.classList.add('hidden')
      setStatus(
        'Institution identified. Your instructor affiliation is pending review; instructor access has not been granted.',
        'success'
      )
    })
  })

  if (token()) loadStatus()
})()

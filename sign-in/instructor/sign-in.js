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

  function handleAuthRedirectState() {
    const redirectType = sessionStorage.getItem('supabase_auth_redirect_type') || ''
    const errorRaw = sessionStorage.getItem('supabase_auth_redirect_error') || ''
    sessionStorage.removeItem('supabase_auth_redirect_type')
    sessionStorage.removeItem('supabase_auth_redirect_error')

    if (errorRaw) {
      let error = {}
      try { error = JSON.parse(errorRaw) } catch { error = {} }
      setStatus(
        window.getAuthErrorMessage?.(
          {
            error_code: error.code,
            error_description: error.description
          },
          'Authentication link could not be completed. Try again.'
        ) || 'Authentication link could not be completed. Try again.',
        'error'
      )
      return false
    }

    if (redirectType === 'recovery' && token()) {
      window.location.replace('/sign-in/update-password/')
      return true
    }

    return false
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', 'Bearer ' + token())
    if (options.body) headers.set('Content-Type', 'application/json')
    return fetch(path, { ...options, headers })
  }

  async function loadStatus() {
    let response
    try {
      response = await api('/api/instructor/verification/status')
    } catch {
      return 'error'
    }

    if (response.status === 401) return 'unauthenticated'
    if (!response.ok) return 'error'

    const body = await response.json()
    if (body.authorizationGranted) {
      setStatus('Instructor affiliation verified. Opening instructor workspace…', 'success')
      window.location.assign('/dashboard/instructor/')
      return 'authorized'
    }
    if (body.verification?.status === 'pending') {
      credentialStep.classList.add('hidden')
      schoolStep.classList.add('hidden')
      const school = body.institution?.schoolName || body.verification.school_code
      setStatus('Verification pending for ' + school + '. Instructor access has not been granted.', '')
      return 'pending'
    }
    return 'ready'
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
      setStatus(
        window.getAuthErrorMessage?.(login, 'Sign-in failed.') || 'Sign-in failed.',
        'error'
      )
      button.disabled = false
      return
    }

    const statusResult = await loadStatus()
    if (statusResult === 'authorized' || statusResult === 'pending') return
    if (statusResult === 'unauthenticated') {
      window.supabaseSignOut?.()
      credentialStep.classList.remove('hidden')
      schoolStep.classList.add('hidden')
      setStatus('Your session expired. Sign in again to continue.', 'error')
      button.disabled = false
      return
    }
    if (statusResult === 'error') {
      credentialStep.classList.remove('hidden')
      schoolStep.classList.add('hidden')
      setStatus('Unable to verify your instructor account right now. Try again.', 'error')
      button.disabled = false
      return
    }

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

  const redirected = handleAuthRedirectState()

  if (!redirected && token()) {
    loadStatus().then((statusResult) => {
      if (statusResult === 'authorized' || statusResult === 'pending') return
      if (statusResult === 'ready') {
        credentialStep.classList.add('hidden')
        schoolStep.classList.remove('hidden')
        setStatus('Account authenticated. Verify your institution to continue.', 'success')
        return
      }
      if (statusResult === 'unauthenticated') {
        window.supabaseSignOut?.()
        credentialStep.classList.remove('hidden')
        schoolStep.classList.add('hidden')
        setStatus('Your session expired. Sign in again to continue.', 'error')
        return
      }
      credentialStep.classList.remove('hidden')
      schoolStep.classList.add('hidden')
      setStatus('Unable to verify your instructor account right now. Try again.', 'error')
    })
  }
})()

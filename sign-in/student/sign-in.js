(function () {
  const form = document.getElementById('studentSignIn')
  const status = document.getElementById('status')
  const button = document.getElementById('submitButton')

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

    if (redirectType === 'recovery' && window.getAccessToken?.()) {
      window.location.replace('/sign-in/update-password/')
      return true
    }

    if (redirectType === 'signup' && window.getAccessToken?.()) {
      setStatus('Email confirmed. Opening your student workspace…', 'success')
      window.location.assign('/dashboard/student/')
      return true
    }

    return false
  }

  handleAuthRedirectState()

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    button.disabled = true
    setStatus('Signing in…', '')

    const result = await window.supabaseSignIn(
      form.email.value.trim(),
      form.password.value
    )

    if (!result?.access_token) {
      setStatus(
        window.getAuthErrorMessage?.(result, 'Sign-in failed.') || 'Sign-in failed.',
        'error'
      )
      button.disabled = false
      return
    }

    setStatus('Signed in. Opening your student workspace…', 'success')
    window.location.assign('/dashboard/student/')
  })
})()

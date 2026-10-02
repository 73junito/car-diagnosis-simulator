(function () {
  const form = document.getElementById('updatePasswordForm')
  const status = document.getElementById('status')
  const button = document.getElementById('updatePasswordButton')

  function setStatus(message, type) {
    status.textContent = message
    status.className = 'status ' + (type || '')
  }

  if (!window.getAccessToken?.()) {
    form.hidden = true
    setStatus(
      'Your recovery session is missing or expired. Request a new password reset link.',
      'error'
    )
    return
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (form.password.value !== form.confirmPassword.value) {
      setStatus('Passwords do not match.', 'error')
      return
    }

    button.disabled = true
    setStatus('Updating your password…', '')
    const result = await window.supabaseUpdatePassword(form.password.value)

    if (result?.error || result?.error_description || result?.code) {
      setStatus(
        window.getAuthErrorMessage?.(
          result,
          'Unable to update your password. Request a new reset link and try again.'
        ) || 'Unable to update your password. Request a new reset link and try again.',
        'error'
      )
      button.disabled = false
      return
    }

    window.supabaseSignOut?.()
    sessionStorage.removeItem('supabase_auth_redirect_type')
    sessionStorage.removeItem('supabase_auth_redirect_error')
    form.hidden = true
    setStatus(
      'Password updated successfully. You can now sign in with your new password.',
      'success'
    )
  })
})()

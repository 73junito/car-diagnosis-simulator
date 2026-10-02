(function () {
  const form = document.getElementById('instructorSignUp')
  const status = document.getElementById('status')
  const button = document.getElementById('createButton')

  function setStatus(message, type) {
    status.textContent = message
    status.className = 'status ' + (type || '')
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (form.password.value !== form.confirmPassword.value) {
      setStatus('Passwords do not match.', 'error')
      return
    }

    button.disabled = true
    setStatus('Creating your account…', '')
    const result = await window.supabaseSignUp(
      form.email.value.trim(),
      form.password.value,
      {
        redirectTo: 'https://app.autolearnpro.com/sign-in/instructor/',
        data: { account_type: 'instructor' }
      }
    )

    if (result?.error || result?.error_description || result?.code) {
      setStatus(
        window.getAuthErrorMessage?.(result, 'Account creation failed.') ||
          'Account creation failed.',
        'error'
      )
      button.disabled = false
      return
    }

    const identities = result?.user?.identities
    if (
      !result?.user ||
      (Array.isArray(identities) && identities.length === 0)
    ) {
      setStatus(
        'Unable to create a new account with these details. If you may already have an account, sign in or reset your password.',
        'error'
      )
      button.disabled = false
      return
    }

    if (result.access_token) {
      setStatus('Account created. Continue with institution verification.', 'success')
      window.location.assign('/sign-in/instructor/')
      return
    }

    setStatus('Account created. Check your email to confirm your address, then return to Instructor Sign In to continue institution verification.', 'success')
    button.disabled = false
  })
})()

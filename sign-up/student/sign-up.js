(function () {
  const form = document.getElementById('studentSignUp')
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
        redirectTo: 'https://app.autolearnpro.com/sign-in/student/',
        data: { account_type: 'student' }
      }
    )

    if (result?.error || result?.error_description || !result?.user) {
      setStatus(result?.error_description || result?.msg || result?.error || 'Account creation failed.', 'error')
      button.disabled = false
      return
    }

    if (result.access_token) {
      setStatus('Account created. Opening your student workspace…', 'success')
      window.location.assign('/dashboard/student/')
      return
    }

    setStatus('Account created. Check your email to confirm your address, then return to Student Sign In.', 'success')
    button.disabled = false
  })
})()

(function () {
  const form = document.getElementById('studentSignIn')
  const status = document.getElementById('status')
  const button = document.getElementById('submitButton')

  function setStatus(message, type) {
    status.textContent = message
    status.className = 'status ' + (type || '')
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    button.disabled = true
    setStatus('Signing in…', '')

    const result = await window.supabaseSignIn(
      form.email.value.trim(),
      form.password.value
    )

    if (!result?.access_token) {
      setStatus(result?.error_description || result?.error || 'Sign-in failed', 'error')
      button.disabled = false
      return
    }

    setStatus('Signed in. Opening your student workspace…', 'success')
    window.location.assign('/dashboard/student/')
  })
})()

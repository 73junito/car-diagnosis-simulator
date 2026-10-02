(function () {
  const form = document.getElementById('recoveryForm')
  const status = document.getElementById('status')
  const button = document.getElementById('recoveryButton')

  function setStatus(message, type) {
    status.textContent = message
    status.className = 'status ' + (type || '')
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    button.disabled = true
    setStatus('Sending reset instructions…', '')

    const result = await window.supabaseRequestPasswordReset(
      form.email.value.trim(),
      'https://app.autolearnpro.com/sign-in/student/'
    )

    if (!result?.ok) {
      setStatus(
        window.getAuthErrorMessage?.(
          result,
          'Unable to send a reset email right now. Try again shortly.'
        ) || 'Unable to send a reset email right now. Try again shortly.',
        'error'
      )
      button.disabled = false
      return
    }

    setStatus(
      'If an account exists for that email, password reset instructions have been sent. Check your inbox and spam folder.',
      'success'
    )
    button.disabled = false
  })
})()

(async function () {
  const message = document.getElementById('verificationMessage')
  const tools = document.getElementById('instructorTools')
  const token = window.getAccessToken ? window.getAccessToken() : null

  if (!token) {
    window.location.replace('/sign-in/instructor/')
    return
  }

  const response = await fetch('/api/instructor/verification/status', {
    headers: { Authorization: 'Bearer ' + token }
  })

  if (!response.ok) {
    window.location.replace('/sign-in/instructor/')
    return
  }

  const body = await response.json()
  if (!body.authorizationGranted) {
    window.location.replace('/sign-in/instructor/')
    return
  }

  message.textContent = body.institution?.schoolName
    ? 'Affiliation verified with ' + body.institution.schoolName + '.'
    : 'Instructor affiliation verified.'
  tools.hidden = false
})()

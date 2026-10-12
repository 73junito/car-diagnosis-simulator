(function(){
  const status = document.getElementById('studentInstitutionClaimStatus')
  const details = document.getElementById('studentInstitutionClaimDetails')
  if (!status || !details) return

  function token(){
    return typeof window.getAccessToken === 'function' ? window.getAccessToken() : null
  }

  async function load(){
    if (typeof window.waitForAuth === 'function') {
      await window.waitForAuth().catch(() => null)
    }

    const accessToken = token()
    if (!accessToken) {
      status.textContent = 'Sign in to view your institution affiliation status.'
      return
    }

    try {
      const response = await fetch('/api/student/institution-claim/status', {
        headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load institution affiliation.')

      const claim = payload.claim
      details.replaceChildren()
      if (!claim) {
        status.textContent = 'No institution affiliation claim is associated with this account.'
        return
      }

      const institution = claim.institution || {}
      const name = institution.schoolName || claim.schoolCode
      const row = document.createElement('p')
      row.textContent = name + ' · status: ' + claim.status
      details.appendChild(row)

      if (claim.reviewNote) {
        const note = document.createElement('p')
        note.textContent = 'Review note: ' + claim.reviewNote
        details.appendChild(note)
      }

      status.textContent = claim.status === 'verified'
        ? 'Your institution affiliation has been verified.'
        : claim.status === 'rejected'
          ? 'Your institution affiliation claim was not verified.'
          : 'Your institution affiliation claim is awaiting review.'
    } catch (error) {
      status.textContent = error.message || 'Unable to load institution affiliation.'
    }
  }

  load()
})()

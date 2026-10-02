(function () {
  const form = document.getElementById('studentSignUp')
  const status = document.getElementById('status')
  const button = document.getElementById('createButton')
  const institutionSearch = document.getElementById('institutionSearch')
  const schoolCode = document.getElementById('schoolCode')
  const resultsBox = document.getElementById('institutionResults')
  const selectedInstitution = document.getElementById('selectedInstitution')
  let searchTimer = null
  let searchSequence = 0

  function setStatus(message, type) {
    status.textContent = message
    status.className = 'status ' + (type || '')
  }

  function closeResults() {
    resultsBox.classList.add('hidden')
    institutionSearch.setAttribute('aria-expanded', 'false')
  }

  function clearSelection() {
    schoolCode.value = ''
    selectedInstitution.textContent = ''
    selectedInstitution.classList.add('hidden')
  }

  function institutionLabel(institution) {
    const place = [
      institution.city,
      institution.stateCode,
      institution.country && institution.country !== 'N/A'
        ? institution.country
        : null
    ].filter(Boolean).join(', ')
    return place ? institution.schoolName + ' — ' + place : institution.schoolName
  }

  function selectInstitution(institution) {
    schoolCode.value = institution.schoolCode
    institutionSearch.value = institution.schoolName
    selectedInstitution.textContent =
      'Selected institution: ' + institutionLabel(institution)
    selectedInstitution.classList.remove('hidden')
    closeResults()
    institutionSearch.focus()
  }

  function renderResults(institutions) {
    resultsBox.innerHTML = ''

    if (!institutions.length) {
      const empty = document.createElement('p')
      empty.className = 'small'
      empty.textContent = 'No matching institutions found. Try another school name.'
      resultsBox.appendChild(empty)
    } else {
      for (const institution of institutions) {
        const option = document.createElement('button')
        option.type = 'button'
        option.className = 'institution-option'
        option.setAttribute('role', 'option')

        const name = document.createElement('strong')
        name.textContent = institution.schoolName
        const detail = document.createElement('span')
        detail.textContent = [
          institution.city,
          institution.stateCode,
          institution.country && institution.country !== 'N/A'
            ? institution.country
            : null
        ].filter(Boolean).join(', ')

        option.append(name, detail)
        option.addEventListener('click', () => selectInstitution(institution))
        resultsBox.appendChild(option)
      }
    }

    resultsBox.classList.remove('hidden')
    institutionSearch.setAttribute('aria-expanded', 'true')
  }

  async function searchInstitutions(query, sequence) {
    try {
      const response = await fetch(
        '/api/institutions/search?q=' + encodeURIComponent(query),
        { headers: { Accept: 'application/json' } }
      )
      if (sequence !== searchSequence) return
      const body = await response.json()
      if (!response.ok) {
        closeResults()
        setStatus(body.error || 'Institution search is unavailable.', 'error')
        return
      }
      renderResults(body.institutions || [])
    } catch {
      if (sequence !== searchSequence) return
      closeResults()
      setStatus('Institution search is unavailable.', 'error')
    }
  }

  institutionSearch.addEventListener('input', () => {
    clearSelection()
    clearTimeout(searchTimer)
    const query = institutionSearch.value.trim()
    searchSequence += 1
    const sequence = searchSequence

    if (query.length < 2) {
      closeResults()
      return
    }

    searchTimer = setTimeout(() => searchInstitutions(query, sequence), 250)
  })

  institutionSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeResults()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (form.password.value !== form.confirmPassword.value) {
      setStatus('Passwords do not match.', 'error')
      return
    }

    if (!schoolCode.value) {
      setStatus('Select your institution from the search results before creating your account.', 'error')
      institutionSearch.focus()
      return
    }

    button.disabled = true
    setStatus('Creating your account…', '')
    const result = await window.supabaseSignUp(
      form.email.value.trim(),
      form.password.value,
      {
        redirectTo: 'https://app.autolearnpro.com/sign-in/student/',
        data: {
          account_type: 'student',
          school_code: schoolCode.value,
          institution_claim_source: 'self-selected-at-registration'
        }
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

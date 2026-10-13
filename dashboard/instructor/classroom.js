(async function () {
  const accessStatus = document.getElementById('classroomAccessStatus')
  const workspace = document.getElementById('classroomWorkspace')
  const classStatus = document.getElementById('classStatus')
  const classList = document.getElementById('classList')
  const createClassForm = document.getElementById('createClassForm')
  const className = document.getElementById('className')
  const refreshClasses = document.getElementById('refreshClasses')
  const rosterContext = document.getElementById('rosterContext')
  const rosterStatus = document.getElementById('rosterStatus')
  const rosterBody = document.getElementById('rosterBody')
  const refreshRoster = document.getElementById('refreshRoster')
  const assignmentForm = document.getElementById('assignmentForm')
  const assignmentSystem = document.getElementById('assignmentSystem')
  const assignmentScenarioIds = document.getElementById('assignmentScenarioIds')
  const assignmentStatus = document.getElementById('assignmentStatus')
  const createAssignment = document.getElementById('createAssignment')
  const studentTargetList = document.getElementById('studentTargetList')

  let classes = []
  let selectedClass = null
  let roster = []

  const token = window.getAccessToken ? window.getAccessToken() : null
  if (!token) {
    window.location.replace('/sign-in/instructor/')
    return
  }

  try {
    const verification = await window.apiGet('/api/instructor/verification/status')
    if (!verification?.authorizationGranted) {
      window.location.replace('/sign-in/instructor/')
      return
    }
    accessStatus.textContent = verification.institution?.schoolName
      ? 'Verified: ' + verification.institution.schoolName
      : 'Instructor verified'
    workspace.hidden = false
  } catch {
    window.location.replace('/sign-in/instructor/')
    return
  }

  function escapeText(value) {
    return String(value ?? '')
  }

  function formatDate(value) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
  }

  function parseScenarioIds(raw) {
    const values = String(raw || '').split(',').map((value) => value.trim()).filter(Boolean)
    return values.map((value) => /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value)
  }

  function renderClasses() {
    classList.replaceChildren()
    if (classes.length === 0) {
      const empty = document.createElement('p')
      empty.textContent = 'No classes yet. Create your first class above.'
      classList.appendChild(empty)
      return
    }

    for (const cls of classes) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'classroom-card'
      button.dataset.classId = cls.id
      button.setAttribute('aria-pressed', selectedClass?.id === cls.id ? 'true' : 'false')

      const name = document.createElement('strong')
      name.textContent = escapeText(cls.name)
      const meta = document.createElement('span')
      meta.textContent = 'Join code: ' + escapeText(cls.class_code || '—')
      button.append(name, meta)
      button.addEventListener('click', () => selectClass(cls))
      classList.appendChild(button)
    }
  }

  function renderRoster() {
    rosterBody.replaceChildren()
    studentTargetList.replaceChildren()

    if (roster.length === 0) {
      const row = document.createElement('tr')
      const cell = document.createElement('td')
      cell.colSpan = 2
      cell.textContent = selectedClass ? 'No students are enrolled in this class.' : 'Select a class to view its roster.'
      row.appendChild(cell)
      rosterBody.appendChild(row)

      const targetEmpty = document.createElement('p')
      targetEmpty.textContent = 'No enrolled students are available for targeted assignment.'
      studentTargetList.appendChild(targetEmpty)
      return
    }

    for (const student of roster) {
      const row = document.createElement('tr')
      const identity = document.createElement('td')
      identity.textContent = student.email || student.id
      const enrolled = document.createElement('td')
      enrolled.textContent = formatDate(student.enrolled_at)
      row.append(identity, enrolled)
      rosterBody.appendChild(row)

      const label = document.createElement('label')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.name = 'studentTarget'
      input.value = student.id
      label.append(input, document.createTextNode(' ' + (student.email || student.id)))
      studentTargetList.appendChild(label)
    }
  }

  async function loadClasses() {
    classStatus.textContent = 'Loading classes…'
    try {
      const body = await window.apiGet('/api/classes')
      classes = Array.isArray(body?.classes) ? body.classes : []
      if (selectedClass) {
        selectedClass = classes.find((cls) => cls.id === selectedClass.id) || null
      }
      renderClasses()
      classStatus.textContent = classes.length ? classes.length + ' class' + (classes.length === 1 ? '' : 'es') + ' loaded.' : 'No classes found.'
      if (!selectedClass && classes.length === 1) await selectClass(classes[0])
    } catch (error) {
      classStatus.textContent = error?.body?.error || 'Unable to load classes.'
    }
  }

  async function loadRoster() {
    if (!selectedClass) return
    rosterStatus.textContent = 'Loading roster…'
    try {
      const body = await window.apiGet('/api/classes/' + encodeURIComponent(selectedClass.id) + '/students')
      roster = Array.isArray(body?.students) ? body.students : []
      renderRoster()
      rosterStatus.textContent = roster.length + ' enrolled student' + (roster.length === 1 ? '' : 's') + '.'
    } catch (error) {
      roster = []
      renderRoster()
      rosterStatus.textContent = error?.body?.error || 'Unable to load roster.'
    }
  }

  async function selectClass(cls) {
    selectedClass = cls
    renderClasses()
    rosterContext.textContent = 'Roster for ' + cls.name + '.'
    refreshRoster.disabled = false
    createAssignment.disabled = false
    assignmentStatus.textContent = 'Ready to create an assignment for ' + cls.name + '.'
    await loadRoster()
  }

  createClassForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const name = className.value.trim()
    if (!name) return
    classStatus.textContent = 'Creating class…'
    try {
      const body = await window.apiPost('/api/classes', { name })
      className.value = ''
      await loadClasses()
      if (body?.class) await selectClass(body.class)
      classStatus.textContent = 'Class created.'
    } catch (error) {
      classStatus.textContent = error?.body?.error || 'Unable to create class.'
    }
  })

  refreshClasses.addEventListener('click', loadClasses)
  refreshRoster.addEventListener('click', loadRoster)

  document.querySelectorAll('input[name="assignmentTarget"]').forEach((input) => {
    input.addEventListener('change', () => {
      studentTargetList.hidden = document.querySelector('input[name="assignmentTarget"]:checked')?.value !== 'students'
    })
  })

  assignmentForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!selectedClass) return

    const scenarioIds = parseScenarioIds(assignmentScenarioIds.value)
    if (scenarioIds.length === 0) {
      assignmentStatus.textContent = 'Enter at least one scenario ID.'
      return
    }

    const target = document.querySelector('input[name="assignmentTarget"]:checked')?.value || 'class'
    const payload = {
      system: assignmentSystem.value.trim(),
      scenarioIds,
      classId: selectedClass.id
    }

    if (target === 'students') {
      const studentIds = Array.from(document.querySelectorAll('input[name="studentTarget"]:checked')).map((input) => input.value)
      if (studentIds.length === 0) {
        assignmentStatus.textContent = 'Select at least one enrolled student.'
        return
      }
      payload.studentIds = studentIds
    }

    assignmentStatus.textContent = 'Creating assignment…'
    createAssignment.disabled = true
    try {
      await window.apiPost('/api/assign', payload)
      assignmentStatus.textContent = 'Assignment created successfully.'
      assignmentScenarioIds.value = ''
    } catch (error) {
      assignmentStatus.textContent = error?.body?.error || 'Unable to create assignment.'
    } finally {
      createAssignment.disabled = !selectedClass
    }
  })

  renderRoster()
  await loadClasses()
})()

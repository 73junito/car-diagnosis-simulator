(function(){
  const status = document.getElementById('transcriptStatus')
  const interpretation = document.getElementById('transcriptInterpretation')
  const totalCount = document.getElementById('totalRecordCount')
  const completedCount = document.getElementById('completedCount')
  const practiceCount = document.getElementById('practiceCount')
  const assessmentCount = document.getElementById('assessmentCount')
  const practiceRecords = document.getElementById('practiceRecords')
  const assessmentRecords = document.getElementById('assessmentRecords')
  const unclassifiedSection = document.getElementById('unclassifiedSection')
  const unclassifiedRecords = document.getElementById('unclassifiedRecords')

  function token(){
    return typeof window.getAccessToken === 'function' ? window.getAccessToken() : null
  }

  function clear(node){
    while (node && node.firstChild) node.removeChild(node.firstChild)
  }

  function item(tag, value, className){
    const el = document.createElement(tag)
    if (className) el.className = className
    el.textContent = value == null ? '' : String(value)
    return el
  }

  function formatScenario(value){
    const raw = String(value || 'Unknown scenario')
    return raw
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function formatDate(value){
    if (!value) return 'Not recorded'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not recorded'
    return date.toLocaleString()
  }

  function statusLabel(record){
    if (record.completed) return 'Completed'
    const state = record.completionState || record.status
    if (!state) return 'In progress'
    return String(state).replaceAll('_', ' ')
  }

  function renderRecord(record){
    const card = item('article', '', 'tm-card')
    card.appendChild(item('h3', formatScenario(record.scenarioId)))

    const meta = item('div', '', 'tm-transcript-record-meta')
    meta.appendChild(item('p', 'Status: ' + statusLabel(record)))
    meta.appendChild(item('p', 'Started: ' + formatDate(record.startedAt)))
    meta.appendChild(item('p', 'Updated: ' + formatDate(record.updatedAt)))
    meta.appendChild(item('p', 'Responses recorded: ' + Number(record.responseCount || 0)))

    if (record.recordType === 'practice') {
      const accuracy = record.practiceAccuracyPct
      meta.appendChild(item(
        'p',
        'Practice accuracy: ' + (accuracy == null ? 'Unavailable' : accuracy + '%')
      ))
    }

    if (record.recordType === 'assessment') {
      const score = record.assessmentScore
      meta.appendChild(item(
        'p',
        'Assessment score: ' + (score == null ? 'Not finalized' : score)
      ))
    }

    card.appendChild(meta)
    return card
  }

  function renderGroup(target, records, emptyMessage){
    clear(target)
    if (!records.length) {
      target.appendChild(item('p', emptyMessage, 'empty-state'))
      return
    }
    records.forEach((record) => target.appendChild(renderRecord(record)))
  }

  async function load(){
    if (typeof window.waitForAuth === 'function') {
      await window.waitForAuth().catch(() => null)
    }

    const accessToken = token()
    if (!accessToken) {
      status.textContent = 'Sign in to view your learning history.'
      renderGroup(practiceRecords, [], 'No practice records are available.')
      renderGroup(assessmentRecords, [], 'No assessment records are available.')
      return
    }

    status.textContent = 'Loading your learning history…'

    try {
      const response = await fetch('/api/student/transcript', {
        headers: {
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json'
        }
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load transcript.')
      }

      const summary = payload.summary || {}
      const records = Array.isArray(payload.records) ? payload.records : []
      const practice = records.filter((record) => record.recordType === 'practice')
      const assessment = records.filter((record) => record.recordType === 'assessment')
      const unclassified = records.filter((record) => record.recordType === 'unclassified')

      totalCount.textContent = String(summary.totalRecords || 0)
      completedCount.textContent = String(summary.completedRecords || 0)
      practiceCount.textContent = String(summary.practiceRecords || 0)
      assessmentCount.textContent = String(summary.assessmentRecords || 0)

      if (payload.interpretation?.statement) {
        interpretation.textContent = payload.interpretation.statement
      }

      renderGroup(practiceRecords, practice, 'No practice records are available yet.')
      renderGroup(assessmentRecords, assessment, 'No assessment records are available yet.')

      if (unclassified.length) {
        unclassifiedSection.hidden = false
        renderGroup(unclassifiedRecords, unclassified, 'No other learning records are available.')
      } else {
        unclassifiedSection.hidden = true
        clear(unclassifiedRecords)
      }

      status.textContent = records.length
        ? 'Learning history loaded.'
        : 'No server-recorded learning history is available yet.'
    } catch (error) {
      status.textContent = error.message || 'Unable to load your learning history.'
      renderGroup(practiceRecords, [], 'Practice history is unavailable.')
      renderGroup(assessmentRecords, [], 'Assessment history is unavailable.')
      unclassifiedSection.hidden = true
    }
  }

  load()
})()

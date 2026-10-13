(function(){
  function qs(sel){ return document.querySelector(sel) }
  const status = qs('#conn-status')
  const reconnectBtn = qs('#reconnect')
  const clearBtn = qs('#clear-feed')
  const list = qs('#event-list')
  const active = qs('#active-sessions')
  const lastEvent = qs('#last-event')
  const classSelect = qs('#live-class')

  let stopped = false
  let reconnectTimer = null
  let cursor = ''
  let activeSessions = new Set()

  function setStatus(text, cls){
    status.textContent = text
    status.className = 'badge ' + (cls || 'badge-warn')
  }

  function addEventToList(evt){
    const li = document.createElement('li')
    const ts = evt.created_at || evt.timestamp || new Date().toISOString()
    const type = evt.event_type || evt.type || 'event'
    const sessionId = evt.session_id || evt.id || ''
    const payload = evt.payload || {}
    li.textContent = `[${ts}] ${type} ${sessionId} ${JSON.stringify(payload)}`
    list.insertBefore(li, list.firstChild)
    while(list.children.length > 500) list.removeChild(list.lastChild)
    lastEvent.textContent = ts
    if (sessionId) activeSessions.add(sessionId)
    active.textContent = String(activeSessions.size)
    if (!cursor || Date.parse(ts) > Date.parse(cursor)) cursor = ts
  }

  function parseSseChunk(text){
    const events = []
    const blocks = String(text || '').split(/\n\n+/)
    for (const block of blocks){
      const dataLines = block.split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
      if (!dataLines.length) continue
      try { events.push(JSON.parse(dataLines.join('\n'))) } catch(e){ void e }
    }
    return events
  }

  function scheduleReconnect(){
    if (stopped || !classSelect.value) return
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 3000)
  }

  async function connect(){
    clearTimeout(reconnectTimer)
    const classId = classSelect.value
    if (!classId){
      setStatus('Select a class', 'badge-warn')
      return
    }

    const token = window.getAccessToken ? window.getAccessToken() : null
    if (!token){
      window.location.replace('/sign-in/instructor/')
      return
    }

    stopped = false
    setStatus('Connecting...', 'badge-warn')

    const q = new URLSearchParams({ classId })
    if (cursor) q.set('since', cursor)
    q.set('limit', '100')
    const base = window.API_BASE_URL ? String(window.API_BASE_URL).replace(/\/$/, '') : ''

    try{
      const res = await fetch(base + '/api/telemetry/stream?' + q.toString(), {
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'text/event-stream'
        },
        credentials: 'same-origin',
        cache: 'no-store'
      })

      if (res.status === 401 || res.status === 403){
        window.location.replace('/sign-in/instructor/')
        return
      }
      if (!res.ok) throw new Error('stream_' + res.status)

      setStatus('Connected', 'badge-success')
      const text = await res.text()
      for (const evt of parseSseChunk(text)) addEventToList(evt)
      scheduleReconnect()
    }catch(e){
      setStatus('Disconnected', 'badge-danger')
      scheduleReconnect()
    }
  }

  async function loadClasses(){
    const token = window.getAccessToken ? window.getAccessToken() : null
    if (!token){
      window.location.replace('/sign-in/instructor/')
      return
    }
    try{
      const result = await window.apiGet('/api/classes')
      const classes = Array.isArray(result?.classes) ? result.classes : []
      classSelect.replaceChildren()
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = classes.length ? 'Select a class' : 'No classes available'
      classSelect.appendChild(placeholder)
      for (const cls of classes){
        const option = document.createElement('option')
        option.value = cls.id
        option.textContent = cls.name
        classSelect.appendChild(option)
      }
      if (classes.length === 1){
        classSelect.value = classes[0].id
        connect()
      }
    }catch(err){
      if (err?.status === 401 || err?.status === 403){
        window.location.replace('/sign-in/instructor/')
        return
      }
      setStatus('Unavailable', 'badge-danger')
    }
  }

  classSelect.addEventListener('change', () => {
    cursor = ''
    activeSessions = new Set()
    active.textContent = '0'
    connect()
  })

  reconnectBtn.addEventListener('click', () => {
    stopped = false
    connect()
  })

  clearBtn.addEventListener('click', () => {
    while (list.firstChild) list.removeChild(list.firstChild)
    lastEvent.textContent = '—'
    activeSessions = new Set()
    active.textContent = '0'
  })

  window.addEventListener('beforeunload', () => {
    stopped = true
    clearTimeout(reconnectTimer)
  })

  loadClasses()
})()

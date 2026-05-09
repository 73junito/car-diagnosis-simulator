document.addEventListener('DOMContentLoaded', ()=>{
  const cardTotal = document.querySelector('#card-total .value')
  const cardConfidence = document.querySelector('#card-confidence .value')
  const cardTime = document.querySelector('#card-time .value')
  const cardSafety = document.querySelector('#card-safety .value')
  const studentTbody = document.querySelector('#student-table tbody')
  const downloadCsv = document.getElementById('download-csv')
  const downloadXapi = document.getElementById('download-xapi')

  async function fetchJson(path){
    const res = await fetch(path);
    if (!res.ok) throw new Error('Fetch failed: '+res.status)
    return res.json()
  }

  function fmtNumber(n, digits=1){ return (Math.round(n*10**digits)/10**digits).toString() }

  // populate summary
  fetchJson('/api/analytics/sessions').then(data=>{
    if (!data || !data.ok) return
    cardTotal.textContent = data.totalSessions ?? '0'
    cardConfidence.textContent = (data.averageConfidence!=null) ? (fmtNumber(data.averageConfidence)+'%') : '—'
    cardTime.textContent = data.averageTime ? `${Math.round(data.averageTime)}s` : '—'
    cardSafety.textContent = data.safetyMisses ?? '0'
  }).catch(e=>{ console.warn('sessions fetch failed', e) })

  // students
  fetchJson('/api/analytics/students').then(data=>{
    if (!data || !data.ok) return
    studentTbody.innerHTML = ''
    (data.students||[]).forEach(s=>{
      const tr = document.createElement('tr')
      const name = document.createElement('td'); name.textContent = s.name || s.id || '—'
      const sessions = document.createElement('td'); sessions.textContent = (s.sessions||0)
      const avgScore = document.createElement('td'); avgScore.textContent = s.avgScore!=null ? fmtNumber(s.avgScore)+'%' : '—'
      const avgConfidence = document.createElement('td'); avgConfidence.textContent = s.avgConfidence!=null ? fmtNumber(s.avgConfidence)+'%' : '—'
      tr.appendChild(name); tr.appendChild(sessions); tr.appendChild(avgScore); tr.appendChild(avgConfidence)
      studentTbody.appendChild(tr)
    })
  }).catch(e=>{ console.warn('students fetch failed', e) })

  // download helpers
  async function download(path, filename){
    try{
      const res = await fetch(path)
      if (!res.ok) { alert('Download failed: '+res.status); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch(err){ alert('Download error') }
  }

  downloadCsv.addEventListener('click', ()=>{
    download('/api/analytics/export?format=csv','student-performance.csv')
  })
  downloadXapi.addEventListener('click', ()=>{
    download('/api/analytics/export?format=xapi','xapi-statements.json')
  })

})

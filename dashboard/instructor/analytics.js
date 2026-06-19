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

  function isFiniteNumber(value){
    return typeof value === 'number' && Number.isFinite(value)
  }

  function readFirstNumber(source, keys){
    for (const key of keys){
      if (isFiniteNumber(source?.[key])) return source[key]
    }
    return null
  }

  function deriveSessionSummary(data){
    const summary = {
      averageTime: isFiniteNumber(data?.averageTime) ? data.averageTime : null,
      safetyMisses: isFiniteNumber(data?.safetyMisses) ? data.safetyMisses : null,
    }

    if (summary.averageTime != null && summary.safetyMisses != null) return summary

    const sessions = Array.isArray(data?.sessions)
      ? data.sessions
      : Array.isArray(data?.items)
        ? data.items
        : []

    if (!sessions.length) return summary

    if (summary.averageTime == null){
      const durations = sessions
        .map(session=>readFirstNumber(session, ['averageTime', 'duration', 'durationSeconds', 'timeSeconds', 'timeSpent']))
        .filter(value=>value != null)
      if (durations.length){
        summary.averageTime = durations.reduce((total, value)=>total + value, 0) / durations.length
      }
    }

    if (summary.safetyMisses == null){
      const misses = sessions
        .map(session=>readFirstNumber(session, ['safetyMisses', 'misses', 'safetyErrors', 'unsafeActions']))
        .filter(value=>value != null)
      if (misses.length){
        summary.safetyMisses = misses.reduce((total, value)=>total + value, 0)
      }
    }

    return summary
  }

  // populate summary
  fetchJson('/api/analytics/sessions').then(data=>{
    if (!data || !data.ok) return
    const summary = deriveSessionSummary(data)
    cardTotal.textContent = data.totalSessions ?? '0'
    cardConfidence.textContent = (data.averageConfidence!=null) ? (fmtNumber(data.averageConfidence)+'%') : '—'
    cardTime.textContent = (summary.averageTime!=null) ? `${Math.round(summary.averageTime)}s` : '—'
    cardSafety.textContent = summary.safetyMisses ?? '0'
  }).catch(e=>{ console.warn('sessions fetch failed', e); });

  // students
  fetchJson('/api/analytics/students').then(data=>{
    if (!data || !data.ok) return
    while (studentTbody.firstChild) studentTbody.removeChild(studentTbody.firstChild);
    (data.students||[]).forEach(s=>{
      const tr = document.createElement('tr')
      tr.className = 'tm-table-row'

      const name = document.createElement('td'); name.textContent = s.name || s.id || '—'

      const sessions = document.createElement('td');
      sessions.className = 'metric-small';
      sessions.textContent = (s.sessions||0)

      const avgScoreValue = s.averageScore != null ? s.averageScore : s.avgScore
      const avgConfidenceValue = s.averageConfidence != null ? s.averageConfidence : s.avgConfidence

      const avgScore = document.createElement('td');
      const scoreSpan = document.createElement('span');
      if (avgScoreValue == null) { scoreSpan.textContent = '—'; scoreSpan.className='metric' }
      else { scoreSpan.textContent = fmtNumber(avgScoreValue)+'%'; scoreSpan.className='metric'; }
      // badge color by thresholds
      if (avgScoreValue != null){
        if (avgScoreValue >= 85) scoreSpan.classList.add('badge-success')
        else if (avgScoreValue >= 70) scoreSpan.classList.add('badge-warn')
        else scoreSpan.classList.add('badge-danger')
      }
      avgScore.appendChild(scoreSpan)

      const avgConfidence = document.createElement('td');
      const confSpan = document.createElement('span');
      if (avgConfidenceValue == null) { confSpan.textContent = '—'; confSpan.className='metric' }
      else { confSpan.textContent = fmtNumber(avgConfidenceValue)+'%'; confSpan.className='metric' }
      if (avgConfidenceValue != null){
        if (avgConfidenceValue >= 80) confSpan.classList.add('badge-success')
        else if (avgConfidenceValue >= 60) confSpan.classList.add('badge-warn')
        else confSpan.classList.add('badge-danger')
      }
      avgConfidence.appendChild(confSpan)

      tr.appendChild(name); tr.appendChild(sessions); tr.appendChild(avgScore); tr.appendChild(avgConfidence)
      studentTbody.appendChild(tr)
    })
  }).catch(e=>{ console.warn('students fetch failed', e); });

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
  });
  downloadXapi.addEventListener('click', ()=>{
    download('/api/analytics/export?format=xapi','xapi-statements.json')
  });

  // --- Live telemetry (SSE) hookup ---
  (function attachLiveTelemetry(){
    try{
      const wrapper = document.createElement('div');
      wrapper.id = 'telemetry-panel';
      wrapper.style.marginTop = '1rem';
      const title = document.createElement('h3'); title.textContent = 'Live Telemetry';
      wrapper.appendChild(title);
      const list = document.createElement('ul'); list.id = 'telemetry-events-list'; list.style.maxHeight = '200px'; list.style.overflow = 'auto'; list.style.fontSize = '0.9rem';
      wrapper.appendChild(list);
      document.body.appendChild(wrapper);

      const s = document.createElement('script');
      s.src = '/dashboard/live-telemetry.js';
      s.onload = function(){
        try{
          const live = (window.liveTelemetry || {}).initLiveTelemetry(function(evt){
            const li = document.createElement('li');
            const ts = evt.timestamp || (new Date()).toISOString();
            li.textContent = `[${ts}] ${evt.type} ${evt.id ? '('+evt.id+')' : ''} ` + (evt.payload ? JSON.stringify(evt.payload) : JSON.stringify(evt));
            list.insertBefore(li, list.firstChild);
            // cap UI list to 200
            while(list.children.length > 200) list.removeChild(list.lastChild);
          });
          // expose for debugging
          window._liveTelemetryHandle = live;
        }catch(e){ console.warn('live telemetry init failed', e) }
      };
      document.body.appendChild(s);
    }catch(e){ /* ignore */ }
  })();

});

// Expose a summary function so other pages (homepage CTA) can consume
window.getDashboardAnalyticsSummary = async function getDashboardAnalyticsSummary(){
  async function safeFetchJson(path){
    try{
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    }catch(e){return null}
  }

  function isFiniteNumber(value){ return typeof value === 'number' && Number.isFinite(value) }

  try{
    const sessionsData = await safeFetchJson('/api/analytics/sessions')
    const studentsData = await safeFetchJson('/api/analytics/students')

    let avgScore = null
    let completionRate = null
    let weakAreas = null

    if (sessionsData && sessionsData.ok){
      if (isFiniteNumber(sessionsData.averageScore)) avgScore = sessionsData.averageScore
      completionRate = sessionsData.completionRate ?? sessionsData.completion ?? null
      weakAreas = sessionsData.weakAreas ?? sessionsData.aseWeaknessesCount ?? null
    }

    if (avgScore == null && studentsData && Array.isArray(studentsData.students)){
      const vals = studentsData.students.map(s=>{
        if (isFiniteNumber(s.averageScore)) return s.averageScore
        if (isFiniteNumber(s.avgScore)) return s.avgScore
        return null
      }).filter(v=>v!=null)
      if (vals.length) avgScore = vals.reduce((a,b)=>a+b,0)/vals.length
    }

    // Top student calculation (if student list available)
    let topStudent = null
    if (studentsData && Array.isArray(studentsData.students) && studentsData.students.length) {
      const best = studentsData.students.reduce((bestSoFar, s) => {
        const val = (isFiniteNumber(s.averageScore) ? s.averageScore : (isFiniteNumber(s.avgScore) ? s.avgScore : -Infinity))
        if (val > (bestSoFar.score ?? -Infinity)) return { name: s.name || s.id || '—', score: Math.round(val) }
        return bestSoFar
      }, null)
      if (best && best.score != null) topStudent = best
      // include id when present
      if (topStudent && !topStudent.id){
        const s = studentsData.students.find(ss=> (ss.name||ss.id) === topStudent.name)
        if (s && s.id) topStudent.id = s.id
      }
    }

    // Ensure numeric rounding for display
    if (avgScore != null) avgScore = Math.round(avgScore)
    if (completionRate != null) completionRate = Math.round(completionRate)

    return { avgScore, completionRate, weakAreas, topStudent }
  }catch(e){ return null }
}

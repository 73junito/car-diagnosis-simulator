document.addEventListener('DOMContentLoaded', ()=>{
  const cardTotal = document.querySelector('#card-total .value')
  const cardConfidence = document.querySelector('#card-confidence .value')
  const cardTime = document.querySelector('#card-time .value')
  const cardSafety = document.querySelector('#card-safety .value')
  const studentTbody = document.querySelector('#student-table tbody')
  const downloadCsv = document.getElementById('download-csv')
  const downloadXapi = document.getElementById('download-xapi')
  const classSelect = document.getElementById('analytics-class')
  const classStatus = document.getElementById('analytics-class-status')

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

  async function loadStudentAnalytics(classId){
    while (studentTbody.firstChild) studentTbody.removeChild(studentTbody.firstChild)
    if (!classId){
      classStatus.textContent = 'Select a class to load student analytics.'
      return
    }

    classStatus.textContent = 'Loading class analytics…'
    try {
      const data = await window.apiGet('/api/analytics/students?classId=' + encodeURIComponent(classId))
      const students = Array.isArray(data?.students) ? data.students : []
      classStatus.textContent = students.length
        ? students.length + ' enrolled student' + (students.length === 1 ? '' : 's') + ' loaded.'
        : 'No enrolled students have analytics for this class.'

      for (const s of students){
        const tr = document.createElement('tr')
        tr.className = 'tm-table-row'

        const name = document.createElement('td'); name.textContent = s.name || s.id || '—'
        const sessions = document.createElement('td'); sessions.className = 'metric-small'; sessions.textContent = s.sessions || 0

        const avgScore = document.createElement('td')
        const scoreSpan = document.createElement('span')
        scoreSpan.className = 'metric'
        scoreSpan.textContent = s.averageScore == null ? '—' : fmtNumber(s.averageScore) + '%'
        avgScore.appendChild(scoreSpan)

        const avgConfidence = document.createElement('td')
        const confSpan = document.createElement('span')
        confSpan.className = 'metric'
        confSpan.textContent = '—'
        confSpan.title = 'Confidence analytics are not yet available from the governed Worker data source.'
        avgConfidence.appendChild(confSpan)

        tr.appendChild(name); tr.appendChild(sessions); tr.appendChild(avgScore); tr.appendChild(avgConfidence)
        studentTbody.appendChild(tr)
      }
    } catch (e) {
      classStatus.textContent = e?.body?.error || 'Unable to load class analytics.'
      console.warn('students fetch failed', e)
    }
  }

  async function loadOwnedClasses(){
    const token = window.getAccessToken ? window.getAccessToken() : null
    if (!token){
      window.location.replace('/sign-in/instructor/')
      return
    }
    try {
      const data = await window.apiGet('/api/classes')
      const classes = Array.isArray(data?.classes) ? data.classes : []
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
        await loadStudentAnalytics(classes[0].id)
      } else {
        classStatus.textContent = classes.length ? 'Select a class to load student analytics.' : 'Create a class before using student analytics.'
      }
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) window.location.replace('/sign-in/instructor/')
      else classStatus.textContent = 'Unable to load owned classes.'
    }
  }

  classSelect.addEventListener('change', () => loadStudentAnalytics(classSelect.value))
  loadOwnedClasses()

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

async function loadAseReadinessSummary() {
  const root = document.getElementById("aseReadinessSummary");
  if (!root) return;

  try {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      root.innerHTML = "<p>ASE readiness data unavailable.</p>";
      return;
    }

    const url =
      `${window.SUPABASE_URL}/rest/v1/ase_readiness_summary` +
      `?select=ase_code,ase_name,attempts,correct_attempts,readiness_pct,avg_time_seconds` +
      `&order=ase_code.asc`;

    const res = await fetch(url, {
      headers: {
        apikey: window.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();

    if (!Array.isArray(rows) || !rows.length) {
      root.innerHTML = "<p>No ASE readiness data available.</p>";
      return;
    }

    root.innerHTML = `
      <table class="analytics-table">
        <thead>
          <tr>
            <th>ASE Area</th>
            <th>Attempts</th>
            <th>Correct</th>
            <th>Readiness</th>
            <th>Avg Time</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => {
            const readiness =
              row.readiness_pct === null || row.readiness_pct === undefined
                ? "No attempts"
                : `${Number(row.readiness_pct).toFixed(0)}%`;

            const avgTime =
              row.avg_time_seconds === null || row.avg_time_seconds === undefined
                ? "—"
                : `${Math.round(Number(row.avg_time_seconds))}s`;

            return `
              <tr>
                <td><strong>${row.ase_code}</strong> — ${row.ase_name}</td>
                <td>${row.attempts}</td>
                <td>${row.correct_attempts}</td>
                <td>${readiness}</td>
                <td>${avgTime}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.warn(
      "ASE readiness data unavailable:",
      err && err.message ? err.message : err
    );
    root.innerHTML = "<p>Unable to load ASE readiness.</p>";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAseReadinessSummary);
} else {
  loadAseReadinessSummary();
}

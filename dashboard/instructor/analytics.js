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
  downloadCsv.disabled = true
  downloadXapi.disabled = true

  function fmtNumber(n, digits=1){ return (Math.round(n*10**digits)/10**digits).toString() }

  async function loadSessionSummary(classId){
    if (!classId){
      cardTotal.textContent = '—'
      cardConfidence.textContent = '—'
      cardTime.textContent = '—'
      cardSafety.textContent = '—'
      return
    }

    try {
      const data = await window.apiGet('/api/analytics/sessions?classId=' + encodeURIComponent(classId))
      if (!data?.ok) return
      cardTotal.textContent = data.totalSessions ?? '0'
      cardConfidence.textContent = data.averageConfidence == null ? '—' : fmtNumber(data.averageConfidence) + '%'
      cardTime.textContent = data.averageTime == null ? '—' : Math.round(data.averageTime) + 's'
      cardSafety.textContent = data.safetyMisses == null ? '—' : data.safetyMisses
    } catch (e) {
      cardTotal.textContent = '—'
      cardConfidence.textContent = '—'
      cardTime.textContent = '—'
      cardSafety.textContent = '—'
      console.warn('sessions fetch failed', e)
    }
  }

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
        scoreSpan.className='metric'
        scoreSpan.textContent = s.averageScore == null ? '—' : fmtNumber(s.averageScore) + '%'
        if (s.averageScore != null){
          if (s.averageScore >= 85) scoreSpan.classList.add('badge-success')
          else if (s.averageScore >= 70) scoreSpan.classList.add('badge-warn')
          else scoreSpan.classList.add('badge-danger')
        }
        avgScore.appendChild(scoreSpan)

        const avgConfidence = document.createElement('td')
        const confSpan = document.createElement('span')
        confSpan.className='metric'
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
        downloadCsv.disabled = false
        downloadXapi.disabled = false
        await Promise.all([
          loadStudentAnalytics(classes[0].id),
          loadSessionSummary(classes[0].id)
        ])
      } else {
        downloadCsv.disabled = true
        downloadXapi.disabled = true
        classStatus.textContent = classes.length ? 'Select a class to load student analytics.' : 'Create a class before using student analytics.'
      }
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) window.location.replace('/sign-in/instructor/')
      else classStatus.textContent = 'Unable to load owned classes.'
    }
  }

  classSelect.addEventListener('change', () => {
    const classId = classSelect.value
    downloadCsv.disabled = !classId
    downloadXapi.disabled = !classId
    loadStudentAnalytics(classId)
    loadSessionSummary(classId)
  })
  loadOwnedClasses()

  // authenticated, class-scoped download helpers
  async function downloadAnalytics(format, filename){
    const classId = classSelect.value
    if (!classId){
      classStatus.textContent = 'Select a class before exporting analytics.'
      return
    }

    const token = window.getAccessToken ? window.getAccessToken() : null
    if (!token){
      window.location.replace('/sign-in/instructor/')
      return
    }

    const base = window.API_BASE_URL ? String(window.API_BASE_URL).replace(/\/$/, '') : ''
    const path = '/api/analytics/export?format=' + encodeURIComponent(format) + '&classId=' + encodeURIComponent(classId)

    try{
      const res = await fetch(base + path, {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'same-origin'
      })
      if (res.status === 401 || res.status === 403){
        window.location.replace('/sign-in/instructor/')
        return
      }
      if (!res.ok) {
        classStatus.textContent = 'Export failed (' + res.status + ').'
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      classStatus.textContent = 'Analytics export ready.'
    }catch(err){
      classStatus.textContent = 'Unable to export analytics.'
    }
  }

  downloadCsv.addEventListener('click', ()=>{
    downloadAnalytics('csv','student-performance.csv')
  });
  downloadXapi.addEventListener('click', ()=>{
    downloadAnalytics('xapi','xapi-statements.json')
  });

  // Live telemetry moved to the class-scoped instructor Live Session surface.


});

// Expose a summary function so other pages (homepage CTA) can consume
window.getDashboardAnalyticsSummary = async function getDashboardAnalyticsSummary(classId){
  async function safeFetchJson(path){
    try{
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    }catch(e){return null}
  }

  function isFiniteNumber(value){ return typeof value === 'number' && Number.isFinite(value) }

  try{
    if (!classId) return null
    const encodedClassId = encodeURIComponent(classId)
    const sessionsData = await safeFetchJson('/api/analytics/sessions?classId=' + encodedClassId)
    const studentsData = await safeFetchJson('/api/analytics/students?classId=' + encodedClassId)

    let avgScore = null
    let completionRate = null
    let weakAreas = null

    if (sessionsData && sessionsData.ok){
      if (isFiniteNumber(sessionsData.averageScore)) avgScore = sessionsData.averageScore
      completionRate = sessionsData.completionRate ?? sessionsData.completion ?? null
      weakAreas = sessionsData.weakAreas ?? sessionsData.diagnosticWeaknessesCount ?? null
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

async function loadDiagnosticReadinessSummary() {
  const root = document.getElementById("diagnosticReadinessSummary");
  if (!root) return;

  try {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      root.innerHTML = "<p>diagnostic readiness data unavailable.</p>";
      return;
    }

    const url =
      `${window.SUPABASE_URL}/rest/v1/diagnostic_readiness_summary` +
      `?select=diagnostic_code,diagnostic_name,attempts,correct_attempts,readiness_pct,avg_time_seconds` +
      `&order=diagnostic_code.asc`;

    const res = await fetch(url, {
      headers: {
        apikey: window.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();

    if (!Array.isArray(rows) || !rows.length) {
      root.innerHTML = "<p>No diagnostic readiness data available.</p>";
      return;
    }

    root.innerHTML = `
      <table class="analytics-table">
        <thead>
          <tr>
            <th>Diagnostic Area</th>
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
                <td><strong>${row.diagnostic_code}</strong> — ${row.diagnostic_name}</td>
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
      "diagnostic readiness data unavailable:",
      err && err.message ? err.message : err
    );
    root.innerHTML = "<p>Unable to load diagnostic readiness.</p>";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadDiagnosticReadinessSummary);
} else {
  loadDiagnosticReadinessSummary();
}

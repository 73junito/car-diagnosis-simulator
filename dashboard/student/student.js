// Expose init function for tests
// New hotspot-based dashboard wiring
window.initStudentDashboard = function(){
  const detail = document.getElementById('detail');
  const detailTitle = document.getElementById('detailTitle');
  const customerComplaint = document.getElementById('customerComplaint');
  const symptomsList = document.getElementById('symptomsList');
  const dtcs = document.getElementById('dtcs');
  const availableTests = document.getElementById('availableTests');
  const backBtn = document.getElementById('backBtn');
  let lastOpener = null;
  let onKeydown = null;

  function showDetail(s, opener){
    lastOpener = opener || document.activeElement || null;
    detail.classList.remove('hidden');
    // prevent background scroll when detail is open
    try{ document.body.classList.add('detail-open'); }catch(e){}
    detailTitle.textContent = s.symptomCategory || s.symptoms || ('Scenario ' + s.id);
    customerComplaint.textContent = s.symptoms || '';
    while(symptomsList.firstChild) symptomsList.removeChild(symptomsList.firstChild);
    (s.symptoms && [s.symptoms] || s.symptomsList || []).forEach(x => {
      const li = document.createElement('li'); li.textContent = x; symptomsList.appendChild(li);
    });
    dtcs.textContent = s.possibleDtcs ? ('Possible DTCs: ' + s.possibleDtcs.join(', ')) : '';
    while(availableTests.firstChild) availableTests.removeChild(availableTests.firstChild);
    if(s.tests){
      const ul = document.createElement('ul');
      Object.keys(s.tests).forEach(k => { const li = document.createElement('li'); li.textContent = `${k}: ${JSON.stringify(s.tests[k])}`; ul.appendChild(li); });
      availableTests.appendChild(ul);
    }
    history.replaceState(null,'',`?scenario=${encodeURIComponent(s.symptomCategory||s.symptoms||s.id)}`);
    try {
      const payload = JSON.stringify({
        session_id: 'student-dashboard',
        event_type: 'scenario_started',
        payload_json: { scenario_id: s.id || s.slug || s.symptomCategory || s.symptoms }
      });
      navigator.sendBeacon('/api/telemetry/events', payload);
    } catch (e) {}
    // focus first meaningful control (back button)
    try{ backBtn.focus(); }catch(e){}
    // add Escape key handler to close
    onKeydown = (e)=>{ if(e.key === 'Escape'){ closeDetail(); } };
    document.addEventListener('keydown', onKeydown);
  }

  function closeDetail(){
    detail.classList.add('hidden');
    try{ document.body.classList.remove('detail-open'); }catch(e){}
    history.replaceState(null,'','/dashboard/student');
    if(onKeydown) { document.removeEventListener('keydown', onKeydown); onKeydown = null; }
    if(lastOpener && typeof lastOpener.focus === 'function'){
      try{ lastOpener.focus(); }catch(e){}
    }
    lastOpener = null;
  }

  backBtn.addEventListener('click', ()=>{ closeDetail(); });

  // Attach hotspot handlers
  document.querySelectorAll('.hotspot').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const slug = btn.dataset.scenario;
      // attempt to find scenario by slug/slugified symptomCategory
      const find = (s) => (s.symptomCategory===slug || s.slug===slug || (s.symptoms && s.symptoms===slug) || String(s.id)===slug || (s.symptomCategory && s.symptomCategory.replace(/\s+/g,'-')===slug));
      const registryScenario = (window.SCENARIO_REGISTRY || []).find(r => r.id === slug || String(r.numericId) === slug);
      const scenario = registryScenario ? (registryScenario.raw || registryScenario) : (window.scenarios||[]).find(find);
      if(scenario){ window.location.href = `/dashboard/student/scenario/?id=${encodeURIComponent(slug)}`; }
      else { window.location.href = `/dashboard/student/scenario/?id=${encodeURIComponent(slug)}`; }
    });
  });

  // If query param present, open scenario
  const params = new URLSearchParams(location.search);
  const q = params.get('scenario');
  if(q && window.scenarios){
    const found = (window.scenarios||[]).find(s => (s.symptomCategory===q || (s.slug===q) || (s.symptoms===q) || String(s.id)===q));
    if(found) showDetail(found);
  }
  // expose helper to open detail programmatically (used by cards and tests)
  try{ window.showScenarioDetail = function(s, opener){ showDetail(s, opener); }; }catch(e){}
};

document.addEventListener('DOMContentLoaded', ()=>{ if(window.initStudentDashboard) window.initStudentDashboard(); });




async function loadPerformanceSummary() {
  const root = document.getElementById("performanceSummary");
  if (!root) return;

  try {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      root.innerHTML = "<p>Performance data unavailable.</p>";
      return;
    }

    const url =
      `${window.SUPABASE_URL}/rest/v1/student_performance_summary` +
      `?select=scenario_id,attempts,correct_attempts,accuracy_pct,avg_time_seconds` +
      `&order=accuracy_pct.asc`;

    const res = await fetch(url, {
      headers: {
        apikey: window.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();

    if (!Array.isArray(rows) || !rows.length) {
      root.innerHTML = "<p>No performance data available yet.</p>";
      return;
    }

    root.innerHTML = `
      <table class="analytics-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Attempts</th>
            <th>Correct</th>
            <th>Accuracy</th>
            <th>Avg Time</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.scenario_id}</td>
              <td>${r.attempts}</td>
              <td>${r.correct_attempts}</td>
              <td>${r.accuracy_pct}%</td>
              <td>${Math.round(Number(r.avg_time_seconds || 0))}s</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Performance summary failed", err);
    root.innerHTML = "<p>Unable to load performance data.</p>";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadPerformanceSummary);
} else {
  loadPerformanceSummary();
}



async function loadStudentTranscriptSummary() {
  const root = document.getElementById("studentTranscriptSummary");
  if (!root) return;

  try {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      root.innerHTML = "<p>Transcript data unavailable.</p>";
      return;
    }

    const url =
      `${window.SUPABASE_URL}/rest/v1/student_transcript_summary` +
      `?select=student_id,scenario_count,attempt_count,correct_attempt_count,accuracy_pct,avg_time_seconds,last_activity`;

    const res = await fetch(url, {
      headers: {
        apikey: window.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rows = await res.json();
    const transcript = Array.isArray(rows) ? rows[0] : null;

    if (!transcript) {
      root.innerHTML = "<p>No transcript data yet.</p>";
      return;
    }

    root.innerHTML = `
      <div class="transcript-grid">
        <div><strong>Student</strong><br>${transcript.student_id}</div>
        <div><strong>Scenarios</strong><br>${transcript.scenario_count}</div>
        <div><strong>Attempts</strong><br>${transcript.attempt_count}</div>
        <div><strong>Correct</strong><br>${transcript.correct_attempt_count}</div>
        <div><strong>Accuracy</strong><br>${transcript.accuracy_pct}%</div>
        <div><strong>Avg Time</strong><br>${Math.round(Number(transcript.avg_time_seconds || 0))}s</div>
      </div>
    `;
  } catch (err) {
    console.error("Student transcript failed", err);
    root.innerHTML = "<p>Unable to load transcript.</p>";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadStudentTranscriptSummary);
} else {
  loadStudentTranscriptSummary();
}


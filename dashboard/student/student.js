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
    history.replaceState(null,'',`?scenario=${encodeURIComponent(s.scenario_key || s.symptomCategory || s.symptoms || s.id)}`);
    try {
      const payload = JSON.stringify({
        session_id: 'student-dashboard',
        event_type: 'scenario_started',
        payload_json: { scenario_id: s.id, scenario_key: s.scenario_key, symptom_category: s.symptomCategory }
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
    history.replaceState(null,'','/dashboard/student/');
    if(onKeydown) { document.removeEventListener('keydown', onKeydown); onKeydown = null; }
    if(lastOpener && typeof lastOpener.focus === 'function'){
      try{ lastOpener.focus(); }catch(e){}
    }
    lastOpener = null;
  }

  backBtn.addEventListener('click', ()=>{ closeDetail(); });

  // If query param present, open scenario
  const params = new URLSearchParams(location.search);
  const q = params.get('scenario') || params.get('id');
  if(q && window.scenarios){
    const found = (window.scenarios||[]).find(s => (
      s.scenario_key === q ||
      String(s.id) === String(q) ||
      s.slug === q ||
      s.symptomCategory === q ||
      (s.symptoms && s.symptoms === q)
    ));
    if(found) showDetail(found);
  }
  // expose helper to open detail programmatically (used by cards and tests)
  try{ window.showScenarioDetail = function(s, opener){ showDetail(s, opener); }; }catch(e){}
};

document.addEventListener('DOMContentLoaded', ()=>{ if(window.initStudentDashboard) window.initStudentDashboard(); });

function getStudentDashboardAccessToken() {
  try {
    if (typeof window.getAccessToken === 'function') {
      const token = window.getAccessToken();
      if (token) return token;
    }
  } catch (_) {}

  try {
    const direct = localStorage.getItem('supabase_access_token');
    if (direct) return direct;

    const legacySession = localStorage.getItem('sb-supabase-session');
    if (legacySession) {
      const parsed = JSON.parse(legacySession);
      if (parsed && parsed.access_token) return parsed.access_token;
    }
  } catch (_) {}

  try {
    return sessionStorage.getItem('auth_token') || null;
  } catch (_) {
    return null;
  }
}

let studentProgressPromise = null;

function fetchStudentProgress() {
  if (studentProgressPromise) return studentProgressPromise;

  const token = getStudentDashboardAccessToken();
  if (!token) return Promise.resolve({ performance: [], transcript: null, unavailable: true });

  studentProgressPromise = fetch('/api/student/progress', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }).catch((error) => {
    studentProgressPromise = null;
    throw error;
  });

  return studentProgressPromise;
}

async function loadPerformanceSummary() {
  const root = document.getElementById("performanceSummary");
  if (!root) return;

  try {
    const body = await fetchStudentProgress();
    if (body.unavailable) {
      root.innerHTML = "<p>Performance data unavailable.</p>";
      return;
    }

    const rows = Array.isArray(body.performance) ? body.performance : [];

    if (!rows.length) {
      root.innerHTML = "<p>No performance data available yet.</p>";
      return;
    }

    root.innerHTML = `
      <table class="analytics-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Responses</th>
            <th>Correct</th>
            <th>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.scenario_id}</td>
              <td>${r.responses}</td>
              <td>${r.correct_responses}</td>
              <td>${r.accuracy_pct}%</td>
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
    const body = await fetchStudentProgress();
    if (body.unavailable) {
      root.innerHTML = "<p>Transcript data unavailable.</p>";
      return;
    }

    const transcript = body.transcript || null;

    if (!transcript) {
      root.innerHTML = "<p>No transcript data yet.</p>";
      return;
    }

    root.innerHTML = `
      <div class="transcript-grid">
        <div><strong>Scenarios</strong><br>${transcript.scenario_count}</div>
        <div><strong>Responses</strong><br>${transcript.response_count}</div>
        <div><strong>Correct</strong><br>${transcript.correct_response_count}</div>
        <div><strong>Accuracy</strong><br>${transcript.accuracy_pct}%</div>
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


async function loadAdaptiveRecommendations() {
  const root = document.getElementById("adaptiveRecommendations");
  if (!root) return;

  try {
    const token = getStudentDashboardAccessToken();
    if (!token) {
      root.innerHTML = "<p>Recommendations unavailable.</p>";
      return;
    }

    const res = await fetch('/api/student/recommendations', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const rows = Array.isArray(body.recommendations) ? body.recommendations : [];

    root.innerHTML = rows.length
      ? `<div class="recommendation-list">${rows.map(row => `
          <article class="recommendation-item">
            <div>
              <strong>${row.scenario_id}</strong>
              <p>${row.reason}</p>
            </div>
            <a class="recommendation-link" href="./scenario/?id=${encodeURIComponent(row.scenario_id)}">Start Practice</a>
          </article>
        `).join("")}</div>`
      : "<p>No recommendations yet.</p>";
  } catch (err) {
    console.error("Adaptive recommendations failed", err);
    root.innerHTML = "<p>Unable to load recommendations.</p>";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadAdaptiveRecommendations);
} else {
  loadAdaptiveRecommendations();
}


async function loadTorqueMindFeedback(payload){

    const panel = document.getElementById("torquemindFeedback");
    const body  = document.getElementById("torquemindContent");

    if(!panel || !body) return;

    panel.style.display = "block";

    body.innerHTML = "<p>Generating explanation...</p>";

    try{

        const feedbackUrl = window.TorqueMindApi?.resolveApiUrl?.("/api/torquemind-feedback")
            || "/api/torquemind-feedback";
        const res = await fetch(feedbackUrl,{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify(payload)

        });

        const data = await res.json();

        body.innerHTML = `
            <h3>Why your answer was incorrect</h3>
            <p>${data.reasonIncorrect}</p>

            <h3>Correct reasoning</h3>
            <p>${data.reasonCorrect}</p>

            <h3>Technical Concept</h3>
            <p>${data.technicalConcept}</p>

            <h3>Next Diagnostic Step</h3>
            <p>${data.nextStep}</p>
        `;

    }
    catch(err){

        console.error(err);

        body.innerHTML =
            "<p>Unable to generate AI explanation.</p>";

    }

}

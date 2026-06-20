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
      const scenario = (window.scenarios||[]).find(find);
      if(scenario){ showDetail(scenario); }
      else { // fallback: navigate via query param
        window.location.href = `/dashboard/student?scenario=${encodeURIComponent(slug)}`;
      }
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

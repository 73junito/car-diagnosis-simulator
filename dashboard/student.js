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

  function showDetail(s){
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
  }

  backBtn.addEventListener('click', ()=>{
    detail.classList.add('hidden');
    try{ document.body.classList.remove('detail-open'); }catch(e){}
    history.replaceState(null,'','/dashboard/student');
  });

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
};

document.addEventListener('DOMContentLoaded', ()=>{ if(window.initStudentDashboard) window.initStudentDashboard(); });

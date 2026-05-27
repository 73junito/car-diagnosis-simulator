(function(){
  function clearChildren(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }

  function populateScenarioSelect(scenarios){
    const sel = document.getElementById('scenario-select'); if(!sel) return;
    clearChildren(sel);
    (scenarios||[]).forEach(s => { const opt = document.createElement('option'); opt.value = s.slug || s.id || s.name; opt.textContent = s.displayName || s.name || s.slug; sel.appendChild(opt); });
  }

  function populateTestChecklist(tests){
    const ul = document.getElementById('test-checklist'); if(!ul) return; clearChildren(ul);
    (tests||[]).forEach(t => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const cb = document.createElement('input'); cb.type='checkbox'; cb.value = t; cb.dataset.test = t;
      label.appendChild(cb); label.appendChild(document.createTextNode(' ' + t)); li.appendChild(label); ul.appendChild(li);
    });
  }

  function resetWorkflow(){
    const txt = document.getElementById('symptom-text'); const diag = document.getElementById('diagnosis-input'); const feedback = document.getElementById('diagnosis-feedback');
    if(txt) txt.value = '';
    if(diag) diag.value = '';
    if(feedback) feedback.textContent = 'No submission yet.';
    const cbs = document.querySelectorAll('#test-checklist input[type=checkbox]'); cbs.forEach(cb => cb.checked = false);
  }

  function submitDiagnosis(){
    const selected = Array.from(document.querySelectorAll('#test-checklist input[type=checkbox]:checked')).map(i=>i.value);
    const diag = document.getElementById('diagnosis-input').value || '';
    const feedback = document.getElementById('diagnosis-feedback');
    if(feedback) feedback.textContent = `Diagnosis submitted — ${diag} — Tests: ${selected.join(', ')}`;
  }

  window.initObd2StudentWorkflow = function(initialScenario){
    const scenarios = window.scenarios || [];
    const testsAvailable = window.testsAvailable || ['OBD Scan','Battery Test','Compression Test'];
    populateScenarioSelect(scenarios);
    populateTestChecklist(testsAvailable);

    const sel = document.getElementById('scenario-select'); if(sel) sel.addEventListener('change', () => resetWorkflow());
    const submit = document.getElementById('submit-diagnosis'); if(submit) submit.addEventListener('click', submitDiagnosis);

    // set initial
    const chosen = scenarios.find(s => s.slug===initialScenario) || scenarios[0] || null;
    if(chosen){ sel.value = chosen.slug || chosen.id || chosen.name; }
    resetWorkflow();
  };

  // expose some helpers for tests
  window._obd2Student = { resetWorkflow, submitDiagnosis, populateTestChecklist };

})();

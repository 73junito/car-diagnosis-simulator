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

    // scoring
    const sel = document.getElementById('scenario-select');
    const scenario = sel ? sel.value : null;
    const rubric = (window.rubrics && window.rubrics[scenario]) || window.rubrics && window.rubrics['default'] || null;
    if(rubric){
      const submission = { symptoms: (document.getElementById('symptom-text')||{}).value || '', tests: selected, diagnosis: diag };
      const scoreObj = calculateScore(submission, rubric);
      renderScoreSummary(scoreObj);
    }
  }

  // Rubric logic
  // rubric shape: { weights: {symptom, tests, diagnosis, safety}, threshold: number, criteria: { expectedDiagnosis, expectedTests: [], symptomKeywords: [], safetyTestName } }
  function calculateScore(submission, rubric){
    const w = rubric.weights || { symptom:0.25, tests:0.25, diagnosis:0.4, safety:0.1 };
    // symptom score: 100 if any keyword matches, else 0
    let symptomScore = 0;
    const text = (submission.symptoms||'').toLowerCase();
    const kws = (rubric.criteria && rubric.criteria.symptomKeywords) || [];
    if(kws.length===0){ symptomScore = 100; } else { symptomScore = kws.some(k=> text.indexOf(k.toLowerCase())!==-1) ? 100 : 0; }

    // tests score: percent of expected tests selected
    const expectedTests = (rubric.criteria && rubric.criteria.expectedTests) || [];
    let testsScore = 100;
    if(expectedTests.length>0){
      const matched = submission.tests.filter(t=> expectedTests.indexOf(t)!==-1).length;
      testsScore = Math.round(matched / expectedTests.length * 100);
    }

    // diagnosis score: full points if matches expectedDiagnosis
    const expectedDiagnosis = (rubric.criteria && rubric.criteria.expectedDiagnosis) || '';
    let diagnosisScore = 0;
    if(!expectedDiagnosis) diagnosisScore = 100; else diagnosisScore = (submission.diagnosis||'').toLowerCase() === expectedDiagnosis.toLowerCase() ? 100 : 0;

    // safety score: 100 if safety test present when required, else 0 or 100 if no requirement
    const safetyTest = (rubric.criteria && rubric.criteria.safetyTestName) || null;
    let safetyScore = 100;
    if(safetyTest){ safetyScore = submission.tests.indexOf(safetyTest)!==-1 ? 100 : 0; }

    const weighted = ( (symptomScore * (w.symptom||0)) + (testsScore * (w.tests||0)) + (diagnosisScore * (w.diagnosis||0)) + (safetyScore * (w.safety||0)) );
    const total = Math.round(weighted);
    const threshold = (rubric.threshold||70);
    const pass = total >= threshold;
    return { total, breakdown: { symptom: symptomScore, tests: testsScore, diagnosis: diagnosisScore, safety: safetyScore }, pass, threshold };
  }

  function renderScoreSummary(scoreObj){
    const panel = document.getElementById('score-summary');
    if(!panel) return;
    panel.hidden = false;
    panel.classList.remove('pass','fail');
    panel.classList.add(scoreObj.pass ? 'pass' : 'fail');
    const value = document.getElementById('score-value');
    const breakdown = document.getElementById('score-breakdown');
    const state = document.getElementById('score-state');
    if(value) value.textContent = `Score: ${scoreObj.total}%`;
    if(breakdown) breakdown.textContent = `Symptom: ${scoreObj.breakdown.symptom}%, Tests: ${scoreObj.breakdown.tests}%, Diagnosis: ${scoreObj.breakdown.diagnosis}%, Safety: ${scoreObj.breakdown.safety}%`;
    if(state) state.textContent = scoreObj.pass ? `PASS (threshold ${scoreObj.threshold}%)` : `FAIL (threshold ${scoreObj.threshold}%)`;
  }

  window.initObd2StudentWorkflow = function(initialScenario){
    const scenarios = window.scenarios || [];
    const testsAvailable = window.testsAvailable || ['OBD Scan','Battery Test','Compression Test'];
    populateScenarioSelect(scenarios);
    populateTestChecklist(testsAvailable);

    const sel = document.getElementById('scenario-select'); if(sel) sel.addEventListener('change', () => { resetWorkflow(); const s = sel.value; loadAttemptState(s); });
    const submit = document.getElementById('submit-diagnosis'); if(submit) submit.addEventListener('click', submitDiagnosis);

    // wire lightweight persistence hooks
    const symptomInput = document.getElementById('symptom-text'); if(symptomInput) symptomInput.addEventListener('input', () => { const s = (document.getElementById('scenario-select')||{}).value; saveAttemptState(s); });
    const diagInput = document.getElementById('diagnosis-input'); if(diagInput) diagInput.addEventListener('input', () => { const s = (document.getElementById('scenario-select')||{}).value; saveAttemptState(s); });
    document.addEventListener('change', (e) => { if(e && e.target && e.target.closest && e.target.closest('#test-checklist')) { const s = (document.getElementById('scenario-select')||{}).value; saveAttemptState(s); } });

    // set initial
    const chosen = scenarios.find(s => s.slug===initialScenario) || scenarios[0] || null;
    if(chosen){ sel.value = chosen.slug || chosen.id || chosen.name; }
    resetWorkflow();
  };

  // expose some helpers for tests
  // persistence helpers
  function saveAttemptState(scenario){
    if(!window.attemptStore) return;
    if(!scenario) return;
    const symptoms = (document.getElementById('symptom-text')||{}).value || '';
    const tests = Array.from(document.querySelectorAll('#test-checklist input[type=checkbox]:checked')).map(i=>i.value);
    const diagnosis = (document.getElementById('diagnosis-input')||{}).value || '';
    const rubric = (window.rubrics && window.rubrics[scenario]) || window.rubrics && window.rubrics['default'] || null;
    const score = rubric ? calculateScore({ symptoms, tests, diagnosis }, rubric) : null;
    window.attemptStore.saveAttempt(scenario, { symptoms, tests, diagnosis, score });
  }

  function loadAttemptState(scenario){
    if(!window.attemptStore) return null;
    const data = window.attemptStore.loadAttempt(scenario);
    if(!data) return null;
    // restore UI
    const txt = document.getElementById('symptom-text'); if(txt) txt.value = data.symptoms || '';
    const diag = document.getElementById('diagnosis-input'); if(diag) diag.value = data.diagnosis || '';
    const cbs = document.querySelectorAll('#test-checklist input[type=checkbox]'); cbs.forEach(cb => { cb.checked = (data.tests || []).indexOf(cb.value) !== -1; cb.dispatchEvent(new Event('change')); });
    if(data.score) renderScoreSummary(data.score);
    return data;
  }

  function resetAttemptState(scenario){
    if(!window.attemptStore) return;
    window.attemptStore.resetAttempt(scenario);
    resetWorkflow();
    const panel = document.getElementById('score-summary'); if(panel) panel.hidden = true;
  }

  window._obd2Student = { resetWorkflow, submitDiagnosis, populateTestChecklist, calculateScore, renderScoreSummary, saveAttemptState, loadAttemptState, resetAttemptState };

})();

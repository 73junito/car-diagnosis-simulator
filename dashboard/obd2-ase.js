(function(){
  function clearChildren(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }

  // simple per-scenario procedural definitions
  const ASE_STEPS = {
    'no-start': [ 'Confirm ignition switch', 'Check battery connections', 'Perform OBD scan', 'Verify starter operation' ],
    'hybrid-ev': [ 'Disable HV system', 'Verify service plug removed', 'Use HV PPE', 'Perform OBD scan' ]
  };

  function populateScenarioSelect(scenarios){
    const sel = document.getElementById('ase-scenario-select'); if(!sel) return;
    clearChildren(sel);
    (scenarios||[]).forEach(s => { const opt = document.createElement('option'); opt.value = s.slug || s.id || s.name; opt.textContent = s.displayName || s.name || s.slug; sel.appendChild(opt); });
  }

  function populateSteps(steps){
    const ul = document.getElementById('ase-step-list'); if(!ul) return; clearChildren(ul);
    (steps||[]).forEach((s, idx) => {
      const li = document.createElement('li'); li.dataset.step = String(idx);
      const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx = String(idx);
      cb.addEventListener('change', () => { toggleStep(idx, cb.checked); const sel = document.getElementById('ase-scenario-select'); const sc = sel ? sel.value : null; saveAttemptState(sc); });
      const span = document.createElement('span'); span.textContent = ' ' + s;
      li.appendChild(cb); li.appendChild(span); ul.appendChild(li);
    });
  }

  function toggleStep(idx, checked){
    const li = document.querySelector(`#ase-step-list li[data-step='${idx}']`);
    if(!li) return;
    li.classList.remove('pass','fail');
    li.classList.add(checked ? 'pass' : 'fail');
  }

  function checkCompletion(){
    const sel = document.getElementById('ase-scenario-select'); const scenario = sel ? sel.value : null;
    const steps = document.querySelectorAll('#ase-step-list input[type=checkbox]');
    const allPassed = Array.from(steps).length > 0 && Array.from(steps).every(cb => cb.checked === true);
    const safetyReq = scenario === 'hybrid-ev';
    const safetyAck = document.getElementById('ase-safety-ack');
    const safetyOk = !safetyReq || (safetyAck && safetyAck.checked === true);
    const complete = allPassed && safetyOk;
    showCompletion(complete);
    return { complete, allPassed, safetyReq, safetyOk };
  }

  function showCompletion(ok){
    const el = document.getElementById('ase-completion-state'); if(!el) return;
    el.classList.remove('complete-pass','complete-fail');
    el.classList.add(ok ? 'complete-pass' : 'complete-fail');
    el.textContent = ok ? 'Procedure Complete — PASS' : 'Procedure Incomplete — FAIL';
    el.classList.remove('hidden');
  }

  function initAseAssessment(initialScenario){
    const scenarios = [{slug:'no-start', displayName:'No Start'},{slug:'hybrid-ev', displayName:'Hybrid EV'}];
    populateScenarioSelect(scenarios);
    const sel = document.getElementById('ase-scenario-select'); if(sel){ sel.addEventListener('change', () => { const s = sel.value; const steps = ASE_STEPS[s] || []; populateSteps(steps); const safetyLabel = document.getElementById('ase-safety-label'); if(safetyLabel) safetyLabel.classList.toggle('hidden', s!=='hybrid-ev'); document.getElementById('ase-completion-state').classList.add('hidden'); loadAttemptState(s); }); }
    const checkBtn = document.getElementById('ase-check-complete'); if(checkBtn) checkBtn.addEventListener('click', () => { const res = checkCompletion(); const sel2 = document.getElementById('ase-scenario-select'); const sc2 = sel2 ? sel2.value : null; saveAttemptState(sc2); return res; });
    // set initial
    const chosen = scenarios.find(s => s.slug===initialScenario) || scenarios[0]; if(chosen){ const selEl = document.getElementById('ase-scenario-select'); selEl.value = chosen.slug; }
    // populate steps and safety
    const s = initialScenario || (scenarios[0] && scenarios[0].slug);
    populateSteps(ASE_STEPS[s] || []);
    const safetyLabel = document.getElementById('ase-safety-label'); if(safetyLabel) safetyLabel.classList.toggle('hidden', s!=='hybrid-ev');
    // wire safety ack to save state
    const ack = document.getElementById('ase-safety-ack'); if(ack) ack.addEventListener('change', () => { const sel2 = document.getElementById('ase-scenario-select'); const sc2 = sel2 ? sel2.value : null; saveAttemptState(sc2); });
  }

  // persistence helpers
  function saveAttemptState(scenario){
    if(!window.attemptStore || !scenario) return;
    const checks = Array.from(document.querySelectorAll('#ase-step-list input[type=checkbox]')).map(cb => !!cb.checked);
    const safety = !!(document.getElementById('ase-safety-ack') && document.getElementById('ase-safety-ack').checked);
    const completion = document.getElementById('ase-completion-state') ? document.getElementById('ase-completion-state').textContent : null;
    window.attemptStore.saveAttempt(scenario, { steps: checks, safetyAck: safety, completion });
  }

  function loadAttemptState(scenario){
    if(!window.attemptStore || !scenario) return null;
    const data = window.attemptStore.loadAttempt(scenario);
    if(!data) return null;
    const checks = document.querySelectorAll('#ase-step-list input[type=checkbox]');
    checks.forEach((cb, idx) => { cb.checked = !!(data.steps && data.steps[idx]); cb.dispatchEvent(new Event('change')); });
    if(document.getElementById('ase-safety-ack')) document.getElementById('ase-safety-ack').checked = !!data.safetyAck;
    if(data.completion) { const el = document.getElementById('ase-completion-state'); if(el){ el.textContent = data.completion; el.classList.remove('hidden'); } }
    return data;
  }

  function resetAttemptState(scenario){ if(!window.attemptStore) return; window.attemptStore.resetAttempt(scenario); const checks = document.querySelectorAll('#ase-step-list input[type=checkbox]'); checks.forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event('change')); }); if(document.getElementById('ase-safety-ack')) document.getElementById('ase-safety-ack').checked = false; const el = document.getElementById('ase-completion-state'); if(el) el.classList.add('hidden'); }

  window._obd2Ase = { initAseAssessment, populateSteps, checkCompletion, saveAttemptState, loadAttemptState, resetAttemptState };
  window.initAseAssessment = initAseAssessment;
})();

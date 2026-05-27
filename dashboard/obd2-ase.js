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
      cb.addEventListener('change', () => toggleStep(idx, cb.checked));
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
    const sel = document.getElementById('ase-scenario-select'); if(sel){ sel.addEventListener('change', () => { const s = sel.value; const steps = ASE_STEPS[s] || []; populateSteps(steps); const safetyLabel = document.getElementById('ase-safety-label'); if(safetyLabel) safetyLabel.classList.toggle('hidden', s!=='hybrid-ev'); document.getElementById('ase-completion-state').classList.add('hidden'); }); }
    const checkBtn = document.getElementById('ase-check-complete'); if(checkBtn) checkBtn.addEventListener('click', checkCompletion);
    // set initial
    const chosen = scenarios.find(s => s.slug===initialScenario) || scenarios[0]; if(chosen){ const selEl = document.getElementById('ase-scenario-select'); selEl.value = chosen.slug; }
    // populate steps and safety
    const s = initialScenario || (scenarios[0] && scenarios[0].slug);
    populateSteps(ASE_STEPS[s] || []);
    const safetyLabel = document.getElementById('ase-safety-label'); if(safetyLabel) safetyLabel.classList.toggle('hidden', s!=='hybrid-ev');
  }

  window._obd2Ase = { initAseAssessment, populateSteps, checkCompletion };
  window.initAseAssessment = initAseAssessment;
})();

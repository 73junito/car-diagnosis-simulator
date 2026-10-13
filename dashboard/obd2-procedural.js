(function(){
  function clearChildren(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }

  // simple per-scenario procedural definitions
  const PROCEDURE_STEPS = {
    'no-start': [ 'Confirm ignition switch', 'Check battery connections', 'Perform OBD scan', 'Verify starter operation' ],
    'hybrid-ev': [ 'Disable HV system', 'Verify service plug removed', 'Use HV PPE', 'Perform OBD scan' ]
  };

  function populateScenarioSelect(scenarios){
    const sel = document.getElementById('procedural-scenario-select'); if(!sel) return;
    clearChildren(sel);
    (scenarios||[]).forEach(s => { const opt = document.createElement('option'); opt.value = s.slug || s.id || s.name; opt.textContent = s.displayName || s.name || s.slug; sel.appendChild(opt); });
  }

  function populateSteps(steps){
    const ul = document.getElementById('procedural-step-list'); if(!ul) return; clearChildren(ul);
    (steps||[]).forEach((s, idx) => {
      const li = document.createElement('li'); li.dataset.step = String(idx);
      const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx = String(idx);
      cb.addEventListener('change', () => { toggleStep(idx, cb.checked); const sel = document.getElementById('procedural-scenario-select'); const sc = sel ? sel.value : null; saveAttemptState(sc); });
      const span = document.createElement('span'); span.textContent = ' ' + s;
      li.appendChild(cb); li.appendChild(span); ul.appendChild(li);
    });
  }

  function toggleStep(idx, checked){
    const li = document.querySelector(`#procedural-step-list li[data-step='${idx}']`);
    if(!li) return;
    li.classList.remove('pass','fail');
    li.classList.add(checked ? 'pass' : 'fail');
  }

  function checkCompletion(){
    const sel = document.getElementById('procedural-scenario-select'); const scenario = sel ? sel.value : null;
    const steps = document.querySelectorAll('#procedural-step-list input[type=checkbox]');
    const allPassed = Array.from(steps).length > 0 && Array.from(steps).every(cb => cb.checked === true);
    const safetyReq = scenario === 'hybrid-ev';
    const safetyAck = document.getElementById('procedural-safety-ack');
    const safetyOk = !safetyReq || (safetyAck && safetyAck.checked === true);
    const complete = allPassed && safetyOk;
    showCompletion(complete);
    return { complete, allPassed, safetyReq, safetyOk };
  }

  function showCompletion(ok){
    const el = document.getElementById('procedural-completion-state'); if(!el) return;
    el.classList.remove('complete-pass','complete-fail');
    el.classList.add(ok ? 'complete-pass' : 'complete-fail');
    el.textContent = ok ? 'Procedure Complete — PASS' : 'Procedure Incomplete — FAIL';
    el.classList.remove('hidden');
  }

  // Detach handle for the most recently bound procedural listeners. Rebinding
  // on every initialization keeps direct-load auto-init plus later manual
  // invocations (tests/tooling) from stacking duplicate handlers.
  let unbindProceduralListeners = null;

  function initProceduralAssessment(initialScenario){
    const scenarios = [{slug:'no-start', displayName:'No Start'},{slug:'hybrid-ev', displayName:'Hybrid EV'}];
    populateScenarioSelect(scenarios);
    // Rebind shared-element handlers on every initialization; handlers from a
    // previous initialization are removed first so listeners never stack.
    if(unbindProceduralListeners){ unbindProceduralListeners(); unbindProceduralListeners = null; }
    const removers = [];
    const sel = document.getElementById('procedural-scenario-select');
    if(sel){
      const onScenarioChange = () => { const s = sel.value; const steps = PROCEDURE_STEPS[s] || []; populateSteps(steps); const safetyLabel = document.getElementById('procedural-safety-label'); if(safetyLabel) safetyLabel.classList.toggle('hidden', s!=='hybrid-ev'); document.getElementById('procedural-completion-state').classList.add('hidden'); loadAttemptState(s); };
      sel.addEventListener('change', onScenarioChange);
      removers.push(() => sel.removeEventListener('change', onScenarioChange));
    }
    const checkBtn = document.getElementById('procedural-check-complete');
    if(checkBtn){
      const onCheckComplete = () => { const res = checkCompletion(); const sel2 = document.getElementById('procedural-scenario-select'); const sc2 = sel2 ? sel2.value : null; saveAttemptState(sc2); return res; };
      checkBtn.addEventListener('click', onCheckComplete);
      removers.push(() => checkBtn.removeEventListener('click', onCheckComplete));
    }
    // set initial
    const chosen = scenarios.find(s => s.slug===initialScenario) || scenarios[0]; if(chosen){ const selEl = document.getElementById('procedural-scenario-select'); selEl.value = chosen.slug; }
    // populate steps and safety
    const s = initialScenario || (scenarios[0] && scenarios[0].slug);
    populateSteps(PROCEDURE_STEPS[s] || []);
    const safetyLabel = document.getElementById('procedural-safety-label'); if(safetyLabel) safetyLabel.classList.toggle('hidden', s!=='hybrid-ev');
    // wire safety ack to save state
    const ack = document.getElementById('procedural-safety-ack');
    if(ack){
      const onAckChange = () => { const sel2 = document.getElementById('procedural-scenario-select'); const sc2 = sel2 ? sel2.value : null; saveAttemptState(sc2); };
      ack.addEventListener('change', onAckChange);
      removers.push(() => ack.removeEventListener('change', onAckChange));
    }
    unbindProceduralListeners = () => { removers.forEach((remove) => { remove(); }); };
  }

  // persistence helpers
  function saveAttemptState(scenario){
    if(!scenario) return;
    const checks = Array.from(document.querySelectorAll('#procedural-step-list input[type=checkbox]')).map(cb => !!cb.checked);
    const safety = !!(document.getElementById('procedural-safety-ack') && document.getElementById('procedural-safety-ack').checked);
    const completion = document.getElementById('procedural-completion-state') ? document.getElementById('procedural-completion-state').textContent : null;
    if(window.attemptAdapter && window.attemptAdapter.saveAttempt) {
      try{ window.attemptAdapter.saveAttempt(scenario, { steps: checks, safetyAck: safety, completion }); }catch(e){ void e; }
    } else if(window.attemptStore && window.attemptStore.saveAttempt){
      try{ window.attemptStore.saveAttempt(scenario, { steps: checks, safetyAck: safety, completion }); }catch(e){ void e; }
    }
  }

  function loadAttemptState(scenario){
    if(!scenario) return null;
    const loader = (window.attemptAdapter && window.attemptAdapter.loadAttempt) ? window.attemptAdapter.loadAttempt : (window.attemptStore && window.attemptStore.loadAttempt);
    if(!loader) return null;
    const maybe = loader(scenario);
    if(maybe && typeof maybe.then === 'function'){
      return maybe.then(data => { if(!data) return null; restoreProceduralUIFromData(data); return data; }).catch(()=>null);
    }
    if(!maybe) return null;
    restoreProceduralUIFromData(maybe);
    return maybe;
  }

  function restoreProceduralUIFromData(data){
    const checks = document.querySelectorAll('#procedural-step-list input[type=checkbox]');
    checks.forEach((cb, idx) => { cb.checked = !!(data.steps && data.steps[idx]); cb.dispatchEvent(new Event('change')); });
    if(document.getElementById('procedural-safety-ack')) document.getElementById('procedural-safety-ack').checked = !!data.safetyAck;
    if(data.completion) { const el = document.getElementById('procedural-completion-state'); if(el){ el.textContent = data.completion; el.classList.remove('hidden'); } }
    return data;
  }

  function resetAttemptState(scenario){
    const resetter = (window.attemptAdapter && window.attemptAdapter.resetAttempt) ? window.attemptAdapter.resetAttempt : (window.attemptStore && window.attemptStore.resetAttempt);
    if(!resetter) return;
    try{ resetter(scenario); }catch(e){ void e; }
    const checks = document.querySelectorAll('#procedural-step-list input[type=checkbox]'); checks.forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event('change')); });
    if(document.getElementById('procedural-safety-ack')) document.getElementById('procedural-safety-ack').checked = false; const el = document.getElementById('procedural-completion-state'); if(el) el.classList.add('hidden');
  }

  window._obd2Procedural = { initProceduralAssessment, populateSteps, checkCompletion, saveAttemptState, loadAttemptState, resetAttemptState };
  window.initProceduralAssessment = initProceduralAssessment;

  // Direct-load initialization: a normal page load invokes the procedural
  // assessment exactly once after the document is ready. Manual invocation of
  // window.initProceduralAssessment() remains supported and rebinds handlers
  // without stacking duplicate listeners.
  let directLoadInitialized = false;
  function initializeOnDirectLoad(){
    if(directLoadInitialized) return;
    directLoadInitialized = true;
    window.initProceduralAssessment();
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initializeOnDirectLoad, { once: true });
  } else {
    initializeOnDirectLoad();
  }
})();

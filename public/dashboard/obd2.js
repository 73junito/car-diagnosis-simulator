(() => {
  function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function renderGauges(state){
    const ids = ['rpm','speed','coolant','voltage'];
    ids.forEach(key => {
      const el = document.getElementById('gauge-' + key);
      if(!el) return;
      const val = state[key];
      const vspan = el.querySelector('.g-value');
      const fill = el.querySelector('.g-fill');
      vspan.textContent = (val !== undefined && val !== null) ? (key==='coolant'? String(val) + '°F' : key==='voltage'? String(val) + 'V' : String(val)) : '--';
      // normalize values to percent for a simple bar visualization
      let pct = 0;
      if(key==='rpm') pct = Math.min(100, Math.round((val||0)/8000*100));
      if(key==='speed') pct = Math.min(100, Math.round((val||0)/200*100));
      if(key==='coolant') pct = Math.min(100, Math.round(((val||0)-60)/200*100));
      if(key==='voltage') pct = Math.min(100, Math.round(((val||0)-9)/6*100));
      if(fill) fill.style.width = pct + '%';
    });
  }

  function renderDtcs(dtcs){
    const ul = document.getElementById('dtc-list');
    if(!ul) return;
    clearChildren(ul);
    if(!dtcs || dtcs.length===0){
      const li = document.createElement('li'); li.textContent = 'No DTCs'; ul.appendChild(li); return;
    }
    dtcs.forEach(code => {
      const li = document.createElement('li'); li.textContent = code; li.dataset.code = code;
      li.addEventListener('click', () => showDtcDetail(code));
      ul.appendChild(li);
    });
  }

  function populateScenarioSelect(scenarios){
    const sel = document.getElementById('scenario-select');
    if(!sel) return;
    clearChildren(sel);
    scenarios.forEach(s => {
      const opt = document.createElement('option'); opt.value = s.slug || s.id || s.name; opt.textContent = s.displayName || s.name || s.slug; sel.appendChild(opt);
    });
  }

  function findScenario(scenarios, slug){
    if(!scenarios) return null;
    return scenarios.find(s => (s.slug && s.slug===slug) || (s.id && s.id===slug)) || scenarios[0] || null;
  }

  window.initObd2Dashboard = function(initialScenario){
    const scenarios = window.scenarios || [];
    populateScenarioSelect(scenarios);
    const sel = document.getElementById('scenario-select');
    sel.addEventListener('change', () => {
      const s = findScenario(scenarios, sel.value);
      if(s) { renderGauges(s.values || {}); renderDtcs(s.dtcs || []); }
    });

    // live scan controls
    const startBtn = document.getElementById('live-start');
    const stopBtn = document.getElementById('live-stop');
    if(startBtn) startBtn.addEventListener('click', () => startLiveScan());
    if(stopBtn) stopBtn.addEventListener('click', () => stopLiveScan());

    const chosen = findScenario(scenarios, initialScenario) || scenarios[0];
    if(chosen){
      sel.value = chosen.slug || chosen.id || chosen.name;
      renderGauges(chosen.values || {});
      renderDtcs(chosen.dtcs || []);
    } else {
      renderGauges({}); renderDtcs([]);
    }
  };

  // Live scan / freeze-frame helpers
  let _liveInterval = null;
  function emitLiveFrame(){
    const ul = document.getElementById('live-list'); if(!ul) return;
    const id = String(Date.now());
    const li = document.createElement('li'); li.textContent = `frame-${id}`; li.dataset.frame = id; ul.appendChild(li);
  }

  function startLiveScan(){ if(_liveInterval) return; _liveInterval = setInterval(emitLiveFrame, 80); }
  function stopLiveScan(){ if(!_liveInterval) return; clearInterval(_liveInterval); _liveInterval = null; }

  function addFreezeFrame(frame){ const ul = document.getElementById('freeze-list'); if(!ul) return; const li = document.createElement('li'); li.textContent = frame.label || (frame.id||'frame'); li.dataset.id = frame.id || String(Date.now()); li.addEventListener('click', () => showFreezeDetail(frame)); ul.appendChild(li); }

  function showFreezeDetail(frame){ const title = document.getElementById('freeze-detail-title'); const desc = document.getElementById('freeze-desc'); if(title) title.textContent = frame.label || 'Frame'; if(desc) desc.textContent = frame.desc || JSON.stringify(frame); }

  // expose live helpers for tests
  window._obd2Live = { emitLiveFrame, startLiveScan, stopLiveScan, addFreezeFrame, showFreezeDetail };

  // DTC detail content (placeholder descriptions)
  const dtcDetails = {
    'P0335': 'Crankshaft Position Sensor A - Circuit/Range',
    'P0300': 'Random/Multiple Cylinder Misfire Detected',
    'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)'
  };

  function showDtcDetail(code){
    const codeEl = document.getElementById('dtc-detail-code');
    const descEl = document.getElementById('dtc-detail-desc');
    if(codeEl) codeEl.textContent = code;
    if(descEl) descEl.textContent = dtcDetails[code] || 'No description available.';
  }

  // expose for tests
  window._obd2Internal = { renderGauges, renderDtcs, showDtcDetail };

})();

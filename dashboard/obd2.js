(() => {
  function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function renderGauges(state){
    const map = {
      rpm: document.getElementById('gauge-rpm'),
      speed: document.getElementById('gauge-speed'),
      coolant: document.getElementById('gauge-coolant'),
      voltage: document.getElementById('gauge-voltage')
    };
    if(!map.rpm) return;
    map.rpm.textContent = state.rpm != null ? String(state.rpm) : '--';
    map.speed.textContent = state.speed != null ? String(state.speed) : '--';
    map.coolant.textContent = state.coolant != null ? String(state.coolant) + '°F' : '--';
    map.voltage.textContent = state.voltage != null ? String(state.voltage) + 'V' : '--';
  }

  function renderDtcs(dtcs){
    const ul = document.getElementById('dtc-list');
    if(!ul) return;
    clearChildren(ul);
    if(!dtcs || dtcs.length===0){
      const li = document.createElement('li'); li.textContent = 'No DTCs'; ul.appendChild(li); return;
    }
    dtcs.forEach(code => { const li = document.createElement('li'); li.textContent = code; ul.appendChild(li); });
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

    const chosen = findScenario(scenarios, initialScenario) || scenarios[0];
    if(chosen){
      sel.value = chosen.slug || chosen.id || chosen.name;
      renderGauges(chosen.values || {});
      renderDtcs(chosen.dtcs || []);
    } else {
      renderGauges({}); renderDtcs([]);
    }
  };

})();

// Diagnostic Engine extracted from script.js
(function(){
  // expose as global
  const Engine = {};

  function formatToolOutput(systemLabel, testName, value, interpretation, conclusion){
    return `[SYSTEM: ${systemLabel}]\nTest: ${testName}\nResult: ${value}\nInterpretation: ${interpretation}\nConclusion: ${conclusion}`;
  }

  // lightweight fault probability model (stored per-session here)
  let faultProbabilities = {};

  // simple fault interactions (kept small)
  const faultInteractions = {
    battery: { affects: { starter: { symptomShift: 'weak_crank', probabilityBoost: 0.2 } } },
    starter: { affects: { battery: { falseIndication: 'low_voltage_reading', probabilityBoost: 0.1 } } }
  };

  function applyEvidenceToModel(component, interpretation){
    if (!faultProbabilities || typeof faultProbabilities !== 'object') return;
    const it = String(interpretation || '').toLowerCase();

    switch(component){
      case 'battery':
        if (it.includes('low') || it.includes('problem') || it.includes('<12v')){
          faultProbabilities.battery = (faultProbabilities.battery || 0.5) + 0.25;
          faultProbabilities.starter = (faultProbabilities.starter || 0.5) - 0.10;
        }
        break;
      case 'starter':
        faultProbabilities.starter = (faultProbabilities.starter || 0.5) + 0.20;
        break;
      case 'fuel':
        if (it.includes('no pressure') || it.includes('0 psi')) faultProbabilities.fuel = (faultProbabilities.fuel || 0.5) + 0.20;
        break;
      case 'obd':
        faultProbabilities.ecu = (faultProbabilities.ecu || 0.5) + 0.15;
        break;
      default:
        break;
    }

    Object.keys(faultInteractions).forEach(fault => {
      const inter = faultInteractions[fault];
      if (inter && inter.affects && inter.affects[component]){
        const effect = inter.affects[component];
        faultProbabilities[fault] = (faultProbabilities[fault] || 0.5) + (effect.probabilityBoost || 0);
      }
    });

    Object.keys(faultProbabilities).forEach(k => {
      faultProbabilities[k] = Math.max(0, Math.min(1, faultProbabilities[k]));
    });
  }

  // useTool: gather evidence from a named test and update model
  Engine.useTool = function(AppState, component){
    const s = (window.scenarios || [])[AppState.scenarioIndex || window.currentIndex] || {tests:{}};
    // initialize engine priors if empty
    if (!faultProbabilities || Object.keys(faultProbabilities).length === 0){
      faultProbabilities = { battery:0.5, starter:0.5, fuel:0.5, ecu:0.5, ignition:0.5 };
    }

    // Build structured evidence from scenario tests (adapted from previous logic)
    const raw = (s.tests && s.tests[component]);
    let output = { system: 'other', reading: 'No data', interpretation: 'UNKNOWN', source: component };
    if (raw) {
      if (typeof raw === 'string') {
        output.reading = raw;
        const txt = raw.toLowerCase();
        if (txt.includes('low') || txt.includes('no pressure') || txt.includes('no fuel') || txt.includes('<12v') || txt.includes('0 psi')) output.interpretation = 'PROBLEM';
        else output.interpretation = 'OK';
        if (component.includes('bat') || component === 'battery' || txt.includes('volt')) output.system = 'electrical';
        else if (component.includes('fuel')) output.system = 'fuel';
        else if (component.includes('spark') || component.includes('ignit')) output.system = 'ignition';
        else if (component.includes('obd')) output.system = 'ecu';
      } else if (typeof raw === 'object') {
        output.system = raw.system || 'other';
        output.reading = raw.reading || '';
        output.interpretation = raw.interpretation || '';
      }
    }

    // compute weight baseline from AppState systemWeights if available
    const sysWeights = window.systemWeights || {electrical:1.0,fuel:1.0,ignition:1.0,air:0.9,ecu:0.9,engine:0.8,cooling:0.8,hvac:0.6,transmission:0.6,other:0.5};
    const baseImportance = sysWeights[output.system] || 0.5;
    const isolationBoost = (AppState.system && AppState.system === output.system) ? 1.2 : 1.0;
    const problemBoost = (/problem|low|no|<12v|0 psi|leak|misfire/i.test(output.reading + ' ' + output.interpretation)) ? 1.4 : 1.0;
    output.weight = +(baseImportance * isolationBoost * problemBoost).toFixed(2);

    // enforce system-locking: penalize if outside isolated system
    if (AppState.system && output.system && AppState.system !== output.system){
      output.weight = +(output.weight * 0.5).toFixed(2);
      output.justification = (output.justification || '') + ' (penalized — outside isolated system)';
    }

    // store evidence in global object for backward compatibility
    window.evidence = window.evidence || {};
    if (!window.evidence[output.system]) window.evidence[output.system] = [];
    output.justification = output.justification || AppState.system || '';
    window.evidence[output.system].push(output);

    // apply evidence into engine model
    try { applyEvidenceToModel(component, output.interpretation || output.reading || ''); } catch(e){ /* fallback */ }

    // update global faultProbabilities snapshot for UI readout
    window.faultProbabilities = Object.assign({}, faultProbabilities);

    // render result text similar to previous UI
    const systemMap = { battery: 'Electrical', starter: 'Starting', fuel: 'Fuel Delivery', obd: 'On-Board Diagnostics' };
    const systemLabel = systemMap[component] || (output.system ? output.system.charAt(0).toUpperCase() + output.system.slice(1) : 'General System');
    const interpretationText = (output.interpretation && /PROBLEM|problem|LOW|low|NO|no|<12v|0 psi|LEAK|leak/i.test(output.reading + ' ' + output.interpretation)) ? 'Below normal operating range' : 'Within expected range';
    let conclusion = 'No immediate fault indicated';
    if (/low|no pressure|<12v|0 psi|leak|stuck|sticky|slipping|slip|misfire|clog/i.test(output.reading + ' ' + output.interpretation)) {
      conclusion = 'Potential issue detected; follow-up testing recommended';
    }
    const formatted = formatToolOutput(systemLabel, component.toUpperCase() + ' TEST', output.reading, interpretationText, conclusion);
    const outEl = document.getElementById('result');
    if (outEl) outEl.innerText = formatted + (AppState.system ? `\n\nReason for isolation: ${AppState.system}` : '');

    // append ranked diagnostic likelihoods
    try {
      if (faultProbabilities && Object.keys(faultProbabilities).length) {
        const ranked = Object.entries(faultProbabilities).sort((a,b)=> b[1]-a[1]).slice(0,3);
        const lines = ranked.map(f => `- ${f[0]}: ${Math.round(f[1]*100)}%`);
        if (outEl) outEl.innerText += `\n\n📊 Diagnostic Likelihoods:\n${lines.join('\n')}`;
        if (component === 'starter' && (faultProbabilities.battery || 0) > 0.6) {
          if (outEl) outEl.innerText += `\n\n⚠️ Note: Starter symptoms may be ambiguous — battery condition is currently likely (${Math.round((faultProbabilities.battery||0)*100)}%).`;
        }
      }
    } catch(e){}

    // update tool counters
    window.toolUses = (window.toolUses || 0) + 1;
    window.totalToolUsed = (window.totalToolUsed || 0) + 1;
    if (window.toolUses > (window.maxToolUses || 3)){
      window.score = Math.max(0, (window.score||0) - 2);
      const scoreEl = document.getElementById('score'); if (scoreEl) scoreEl.innerText = `Score: ${window.score}`;
    }
    const toolsLeftEl = document.getElementById('toolsLeft'); if (toolsLeftEl) toolsLeftEl.innerText = `Tools left: ${Math.max(0,(window.maxToolUses||3) - window.toolUses)}`;

    // persist progress
    try { if (window.saveProgress) window.saveProgress(); } catch(e){}

    return output;
  };

  // diagnose: show confidence panel if UI-driven; set pending choice
  Engine.diagnose = function(AppState, choice){
    window.pendingDiagnosisChoice = choice;
    const panel = document.getElementById('confidencePanel'); if (panel) panel.style.display = 'block';
  };

  // applyDiagnosisWithConfidence: reproduce previous evaluation logic
  Engine.applyDiagnosisWithConfidence = async function(AppState, conf){
    const choice = window.pendingDiagnosisChoice;
    window.pendingDiagnosisChoice = null;
    const s = (window.scenarios || [])[AppState.scenarioIndex || window.currentIndex] || {};
    const outEl = document.getElementById('result');
    const confScore = conf === 'high' ? 10 : (conf === 'medium' ? 6 : 3);

    let correct = false;
    const sys = (choice === 'battery' || choice === 'starter' || choice === 'alternator') ? 'electrical'
              : (choice === 'fuel' ? 'fuel' : (choice === 'spark' || choice === 'spark_plugs' ? 'ignition' : null));

    if (sys && window.evidence && window.evidence[sys] && window.evidence[sys].length > 0) {
      const evidenceSum = window.evidence[sys].reduce((a,c)=> a + (c.weight || 0), 0);
      const totalSum = Object.keys(window.evidence||{}).reduce((a,k)=> a + (window.evidence[k]||[]).reduce((x,y)=> x + (y.weight||0), 0), 0) || 1;
      const relevance = evidenceSum / totalSum;
      const problematic = window.evidence[sys].some(e => /low|no|problem|leak|slip|misfire|degrad|sticky|clog|<12v|0 psi/i.test(e.reading + ' ' + e.interpretation));
      const faultMatch = (s.fault && s.fault.includes(choice));
      const isolationCorrect = (AppState.system === sys) || (window.selectedSystem === sys);
      if (faultMatch && (relevance >= 0.2 || isolationCorrect || problematic)) correct = true; else correct = false;
    } else {
      correct = (choice === s.fault);
    }

    if (correct) {
      window.correctAnswers = (window.correctAnswers || 0) + 1;
      const isolationBonus = (AppState.system ? (AppState.system === sys ? 2 : -2) : 0);
      window.score = (window.score || 0) + confScore + (isolationBonus || 0);
      if (outEl) outEl.innerText = `✅ Correct diagnosis based on evidence (+${confScore + (isolationBonus>0?isolationBonus:0)} pts)`;
    } else {
      window.wrongAnswers = (window.wrongAnswers || 0) + 1;
      window.score = Math.max(0, (window.score||0) - 5);
      if (outEl) outEl.innerText = `❌ Incorrect diagnosis (-5 pts)`;
    }
    const scoreEl = document.getElementById('score'); if (scoreEl) scoreEl.innerText = `Score: ${window.score}`;

    // Build explanation object
    try {
      const evidenceSum = (sys && window.evidence[sys]) ? window.evidence[sys].reduce((a,c)=> a + (c.weight || 0), 0) : 0;
      const totalSum = Object.keys(window.evidence||{}).reduce((a,k)=> a + (window.evidence[k]||[]).reduce((x,y)=> x + (y.weight||0), 0), 0) || 1;
      const relevance = totalSum ? (evidenceSum / totalSum) : 0;
      const isolationCorrect = (AppState.system === sys) || (window.selectedSystem === sys);
      const topEvidence = (sys && window.evidence[sys]) ? (window.evidence[sys].slice().sort((a,b)=> (b.weight||0)-(a.weight||0)).slice(0,3).map(e=>({reading:e.reading, interpretation:e.interpretation, weight:e.weight, source:e.source}))) : [];
      const isolationBonus = AppState.system ? (AppState.system === sys ? 2 : -2) : 0;
      const lastExplanation = {
        selectedSystem: AppState.system || window.selectedSystem || null,
        diagnosedSystem: sys || null,
        systemRationale: AppState.system || '',
        relevance: +relevance.toFixed(2),
        evidenceSum: +evidenceSum.toFixed(2),
        totalSum: +totalSum.toFixed(2),
        topEvidence,
        isolationCorrect,
        confidence: conf,
        scoreDelta: correct ? (confScore + isolationBonus) : -5,
        final: correct ? 'Correct' : 'Incorrect',
        scenarioIndex: AppState.scenarioIndex || window.currentIndex
      };

      // update window.lastExplanation for backward compatibility
      window.lastExplanation = lastExplanation;

      // update student profile
      try {
        const isCorrect = (lastExplanation.final === 'Correct');
        if (window.updateStudentProfile) window.updateStudentProfile(isCorrect, AppState.system || 'unspecified', s.fault || null);
      } catch(e){}

      // render into DOM
      const panel = document.getElementById('explanationPanel'); if (panel) panel.style.display = 'block';
      const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
      setText('exp-system', lastExplanation.selectedSystem || '—');
      setText('exp-rationale', lastExplanation.systemRationale || '—');
      setText('exp-relevance', Math.round(lastExplanation.relevance * 100) + '%');
      setText('exp-isolation', lastExplanation.isolationCorrect ? 'Correct' : 'Incorrect');
      setText('exp-confidence', lastExplanation.confidence);
      const reasoningEl = document.getElementById('exp-reasoning');
      if (reasoningEl) {
        if (lastExplanation.topEvidence && lastExplanation.topEvidence.length) {
          const s2 = lastExplanation.topEvidence.map(e => `${e.reading} (${e.interpretation})`).join('; ');
          reasoningEl.innerText = `Technician reasoning: observed ${s2}.`;
        } else {
          reasoningEl.innerText = 'Technician reasoning: No system-specific evidence collected.';
        }
      }
      const evidEl = document.getElementById('exp-evidence');
      if (evidEl) {
        evidEl.innerHTML = '';
        if (lastExplanation.topEvidence.length === 0) evidEl.innerHTML = '<div class="evidence-entry">(no system-specific evidence collected)</div>';
        lastExplanation.topEvidence.forEach(ev => {
          const d = document.createElement('div'); d.className = 'evidence-entry'; d.innerText = `${ev.reading} — ${ev.interpretation} (w:${ev.weight})`; evidEl.appendChild(d);
        });
      }
      setText('exp-final', `Result: ${lastExplanation.final}. Score change: ${lastExplanation.scoreDelta}`);
    } catch (e) { console.warn('Failed to build explanation', e); }

    // hide confidence panel
    const panel = document.getElementById('confidencePanel'); if (panel) panel.style.display = 'none';

    // advance scenario
    window.currentIndex = (window.currentIndex || 0) + 1;
    if (window.saveProgress) await window.saveProgress();
    if (window.currentIndex < (window.scenarios || []).length){ setTimeout(() => { if (window.loadScenario) window.loadScenario(); }, 1200); }
    else { setTimeout(() => { if (window.endGame) window.endGame(); }, 800); }
  };

  // expose Engine
  window.DiagnosticEngine = Engine;

  // small helper bound into engine scope (keeps model consistent with engine internals)
  function applyEvidenceToModel(component, interpretation){
    applyEvidenceToModel = applyEvidenceToModel; // noop placeholder to avoid linter
    // call internal implementation
    // internal implementation uses faultProbabilities and faultInteractions defined above
    const it = String(interpretation || '').toLowerCase();
    switch(component){
      case 'battery':
        if (it.includes('low') || it.includes('problem') || it.includes('<12v')){
          faultProbabilities.battery = (faultProbabilities.battery || 0.5) + 0.25;
          faultProbabilities.starter = (faultProbabilities.starter || 0.5) - 0.10;
        }
        break;
      case 'starter':
        faultProbabilities.starter = (faultProbabilities.starter || 0.5) + 0.20;
        break;
      case 'fuel':
        if (it.includes('no pressure') || it.includes('0 psi')) faultProbabilities.fuel = (faultProbabilities.fuel || 0.5) + 0.20;
        break;
      case 'obd':
        faultProbabilities.ecu = (faultProbabilities.ecu || 0.5) + 0.15;
        break;
      default:
        break;
    }
    Object.keys(faultInteractions).forEach(fault => {
      const inter = faultInteractions[fault];
      if (inter && inter.affects && inter.affects[component]){
        const effect = inter.affects[component];
        faultProbabilities[fault] = (faultProbabilities[fault] || 0.5) + (effect.probabilityBoost || 0);
      }
    });
    Object.keys(faultProbabilities).forEach(k => { faultProbabilities[k] = Math.max(0, Math.min(1, faultProbabilities[k])); });
    // sync global snapshot
    window.faultProbabilities = Object.assign({}, faultProbabilities);
  }

})();
// Lightweight Diagnostic Engine extracted from script.js
(function(){
  const DiagnosticEngine = {};

  // internal fault probability store (shared)
  DiagnosticEngine.faultProbabilities = {};

  DiagnosticEngine.faultInteractions = {
    battery: {
      affects: {
        starter: { symptomShift: 'weak_crank', probabilityBoost: 0.2 }
      }
    },
    starter: {
      affects: {
        battery: { falseIndication: 'low_voltage_reading', probabilityBoost: 0.1 }
      }
    }
  };

  DiagnosticEngine.formatToolOutput = function(systemLabel, testName, value, interpretation, conclusion){
    return `[SYSTEM: ${systemLabel}]\nTest: ${testName}\nResult: ${value}\nInterpretation: ${interpretation}\nConclusion: ${conclusion}`;
  };

  DiagnosticEngine.applyEvidenceToModel = function(component, interpretation){
    const fp = DiagnosticEngine.faultProbabilities;
    if (!fp || typeof fp !== 'object') return;
    const it = String(interpretation || '').toLowerCase();

    switch(component){
      case 'battery':
        if (it.includes('low') || it.includes('problem') || it.includes('<12v')){
          fp.battery = (fp.battery || 0.5) + 0.25;
          fp.starter = (fp.starter || 0.5) - 0.10;
        }
        break;
      case 'starter':
        fp.starter = (fp.starter || 0.5) + 0.20;
        break;
      case 'fuel':
        if (it.includes('no pressure') || it.includes('0 psi')) fp.fuel = (fp.fuel || 0.5) + 0.20;
        break;
      case 'obd':
        fp.ecu = (fp.ecu || 0.5) + 0.15;
        break;
      default:
        break;
    }

    Object.keys(DiagnosticEngine.faultInteractions).forEach(fault => {
      const inter = DiagnosticEngine.faultInteractions[fault];
      if (inter && inter.affects && inter.affects[component]){
        const effect = inter.affects[component];
        fp[fault] = (fp[fault] || 0.5) + (effect.probabilityBoost || 0);
      }
    });

    Object.keys(fp).forEach(k => { fp[k] = Math.max(0, Math.min(1, fp[k])); });
  };

  // Use a tool (previously `check` in script.js)
  DiagnosticEngine.useTool = function(component){
    // rely on globals from script.js (evidence, selectedSystem, systemJustification, systemWeights, maxToolUses, toolUses, totalToolUsed)
    const s = (window.currentScenario && window.currentScenario()) || {};
    if (!window.selectedSystem) {
      if (document.getElementById('result')) document.getElementById('result').innerText = '🔎 Please select the suspected SYSTEM first.';
      return;
    }
    if(window.toolUses >= window.maxToolUses){
      if (document.getElementById('result')) document.getElementById('result').innerText = '⚠️ No tool uses left!';
      return;
    }

    window.toolUses++;
    window.totalToolUsed++;

    const raw = (s.tests && s.tests[component]);
    let output = { system: 'other', reading: 'No data', interpretation: 'UNKNOWN', source: component };
    if (raw) {
      if (typeof raw === 'string') {
        output.reading = raw;
        const txt = raw.toLowerCase();
        if (txt.includes('low') || txt.includes('no pressure') || txt.includes('no fuel') || txt.includes('<12v') || txt.includes('0 psi')) output.interpretation = 'PROBLEM';
        else output.interpretation = 'OK';
        if (component.includes('bat') || component === 'battery' || txt.includes('volt')) output.system = 'electrical';
        else if (component.includes('fuel')) output.system = 'fuel';
        else if (component.includes('spark') || component.includes('ignit')) output.system = 'ignition';
        else if (component.includes('obd')) output.system = 'ecu';
      } else if (typeof raw === 'object') {
        output.system = raw.system || 'other';
        output.reading = raw.reading || '';
        output.interpretation = raw.interpretation || '';
      }
    }

    if (!window.evidence[output.system]) window.evidence[output.system] = [];
    output.justification = window.systemJustification || '';
    const baseImportance = window.systemWeights[output.system] || 0.5;
    const isolationBoost = (window.selectedSystem && window.selectedSystem === output.system) ? 1.2 : 1.0;
    const problemBoost = (/problem|low|no|<12v|0 psi|leak|misfire/i.test(output.reading + ' ' + output.interpretation)) ? 1.4 : 1.0;
    output.weight = +(baseImportance * isolationBoost * problemBoost).toFixed(2);
    window.evidence[output.system].push(output);
    output.contextSystem = window.selectedSystem || 'unspecified';

    try { DiagnosticEngine.applyEvidenceToModel(component, output.interpretation || output.reading || ''); } catch(e){}

    const systemMap = { battery: 'Electrical', starter: 'Starting', fuel: 'Fuel Delivery', obd: 'On-Board Diagnostics' };
    const systemLabel = systemMap[component] || (output.system ? output.system.charAt(0).toUpperCase() + output.system.slice(1) : 'General System');
    const interpretationText = (output.interpretation && /PROBLEM|problem|LOW|low|NO|no|<12v|0 psi|LEAK|leak/i.test(output.reading + ' ' + output.interpretation)) ? 'Below normal operating range' : 'Within expected range';
    let conclusion = 'No immediate fault indicated';
    if (/low|no pressure|<12v|0 psi|leak|stuck|sticky|slipping|slip|misfire|clog/i.test(output.reading + ' ' + output.interpretation)) {
      conclusion = 'Potential issue detected; follow-up testing recommended';
    }
    const formatted = DiagnosticEngine.formatToolOutput(systemLabel, component.toUpperCase() + ' TEST', output.reading, interpretationText, conclusion);
    if (document.getElementById('result')) document.getElementById('result').innerText = formatted + (window.systemJustification ? `\n\nReason for isolation: ${window.systemJustification}` : '');

    try {
      if (DiagnosticEngine.faultProbabilities && Object.keys(DiagnosticEngine.faultProbabilities).length) {
        const ranked = Object.entries(DiagnosticEngine.faultProbabilities).sort((a,b)=> b[1]-a[1]).slice(0,3);
        const lines = ranked.map(f => `- ${f[0]}: ${Math.round(f[1]*100)}%`);
        if (document.getElementById('result')) document.getElementById('result').innerText += `\n\n📊 Diagnostic Likelihoods:\n${lines.join('\n')}`;
        if (component === 'starter' && (DiagnosticEngine.faultProbabilities.battery || 0) > 0.6) {
          if (document.getElementById('result')) document.getElementById('result').innerText += `\n\n⚠️ Note: Starter symptoms may be ambiguous — battery condition is currently likely (${Math.round((DiagnosticEngine.faultProbabilities.battery||0)*100)}%).`;
        }
      }
    } catch(e){}

    if(window.toolUses > 2){
      window.score = Math.max(0, window.score - 2);
      if (document.getElementById('score')) document.getElementById('score').innerText = `Score: ${window.score}`;
    }
    if (document.getElementById('toolsLeft')) document.getElementById('toolsLeft').innerText = `Tools left: ${window.maxToolUses - window.toolUses}`;
    if (window.saveProgress) window.saveProgress();
  };

  // expose diagnosis functions (diagnose UI and apply with confidence)
  DiagnosticEngine.diagnose = function(choice){
    window.pendingDiagnosisChoice = choice;
    const panel = document.getElementById('confidencePanel'); if (panel) panel.style.display = 'block';
  };

  DiagnosticEngine.applyDiagnosisWithConfidence = async function(conf){
    const choice = window.pendingDiagnosisChoice;
    window.pendingDiagnosisChoice = null;
    const s = (window.currentScenario && window.currentScenario()) || {};
    const out = document.getElementById('result');
    const confScore = conf === 'high' ? 10 : (conf === 'medium' ? 6 : 3);

    let correct = false;
    const sys = (choice === 'battery' || choice === 'starter' || choice === 'alternator') ? 'electrical'
              : (choice === 'fuel' ? 'fuel' : (choice === 'spark' || choice === 'spark_plugs' ? 'ignition' : null));

    if (sys && window.evidence[sys] && window.evidence[sys].length > 0) {
      const evidenceSum = window.evidence[sys].reduce((a,c)=> a + (c.weight || 0), 0);
      const totalSum = Object.keys(window.evidence).reduce((a,k)=> a + (window.evidence[k]||[]).reduce((x,y)=> x + (y.weight||0), 0), 0) || 1;
      const relevance = evidenceSum / totalSum;
      const problematic = window.evidence[sys].some(e => /low|no|problem|leak|slip|misfire|degrad|sticky|clog|<12v|0 psi/i.test(e.reading + ' ' + e.interpretation));
      const faultMatch = (s.fault && s.fault.includes(choice));
      const isolationCorrect = window.selectedSystem === sys;
      if (faultMatch && (relevance >= 0.2 || isolationCorrect || problematic)) correct = true;
      else correct = false;
    } else {
      correct = (choice === s.fault);
    }

    if (correct) {
      window.correctAnswers++;
      const isolationBonus = window.selectedSystem ? (window.selectedSystem === sys ? 2 : -2) : 0;
      window.score += confScore + isolationBonus;
      if (out) out.innerText = `✅ Correct diagnosis based on evidence (+${confScore + (isolationBonus>0?isolationBonus:0)} pts)`;
    } else {
      window.wrongAnswers++;
      window.score = Math.max(0, window.score - 5);
      if (out) out.innerText = `❌ Incorrect diagnosis (-5 pts)`;
    }
    if (document.getElementById('score')) document.getElementById('score').innerText = `Score: ${window.score}`;

    try {
      const evidenceSum = (sys && window.evidence[sys]) ? window.evidence[sys].reduce((a,c)=> a + (c.weight || 0), 0) : 0;
      const totalSum = Object.keys(window.evidence).reduce((a,k)=> a + (window.evidence[k]||[]).reduce((x,y)=> x + (y.weight||0), 0), 0) || 1;
      const relevance = totalSum ? (evidenceSum / totalSum) : 0;
      const isolationCorrect = window.selectedSystem === sys;
      const topEvidence = (sys && window.evidence[sys]) ? (window.evidence[sys].slice().sort((a,b)=> (b.weight||0)-(a.weight||0)).slice(0,3).map(e=>({reading:e.reading, interpretation:e.interpretation, weight:e.weight, source:e.source}))) : [];
      const isolationBonus = window.selectedSystem ? (window.selectedSystem === sys ? 2 : -2) : 0;
      window.lastExplanation = {
        selectedSystem: window.selectedSystem || null,
        diagnosedSystem: sys || null,
        systemRationale: window.systemJustification || '',
        relevance: +relevance.toFixed(2),
        evidenceSum: +evidenceSum.toFixed(2),
        totalSum: +totalSum.toFixed(2),
        topEvidence,
        isolationCorrect,
        confidence: conf,
        scoreDelta: correct ? (confScore + isolationBonus) : -5,
        final: correct ? 'Correct' : 'Incorrect',
        scenarioIndex: window.currentIndex || 0
      };

      try { window.updateStudentProfile && window.updateStudentProfile(window.lastExplanation.final === 'Correct', window.selectedSystem || 'unspecified', s.fault || null); } catch(e){}

      const panel = document.getElementById('explanationPanel'); if (panel) panel.style.display = 'block';
      const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
      setText('exp-system', window.lastExplanation.selectedSystem || '—');
      setText('exp-rationale', window.lastExplanation.systemRationale || '—');
      setText('exp-relevance', Math.round(window.lastExplanation.relevance * 100) + '%');
      setText('exp-isolation', window.lastExplanation.isolationCorrect ? 'Correct' : 'Incorrect');
      setText('exp-confidence', window.lastExplanation.confidence);
      const reasoningEl = document.getElementById('exp-reasoning');
      if (reasoningEl) {
        if (window.lastExplanation.topEvidence && window.lastExplanation.topEvidence.length) {
          const s2 = window.lastExplanation.topEvidence.map(e => `${e.reading} (${e.interpretation})`).join('; ');
          reasoningEl.innerText = `Technician reasoning: observed ${s2}.`;
        } else {
          reasoningEl.innerText = 'Technician reasoning: No system-specific evidence collected.';
        }
      }
      const evidEl = document.getElementById('exp-evidence');
      if (evidEl) {
        evidEl.innerHTML = '';
        if (window.lastExplanation.topEvidence.length === 0) evidEl.innerHTML = '<div class="evidence-entry">(no system-specific evidence collected)</div>';
        window.lastExplanation.topEvidence.forEach(ev => { const d = document.createElement('div'); d.className='evidence-entry'; d.innerText = `${ev.reading} — ${ev.interpretation} (w:${ev.weight})`; evidEl.appendChild(d); });
      }
      setText('exp-final', `Result: ${window.lastExplanation.final}. Score change: ${window.lastExplanation.scoreDelta}`);
    } catch(e){}

    const summary = [];
    Object.keys(window.evidence).forEach(k => { if (window.evidence[k] && window.evidence[k].length) summary.push(`${k}: ${window.evidence[k].map(e=>e.reading + ' ('+e.interpretation+')').join('; ')}`); });
    if (summary.length && out) out.innerText += '\n\nEvidence:\n' + summary.join('\n');

    const panel = document.getElementById('confidencePanel'); if (panel) panel.style.display = 'none';

    window.currentIndex = (window.currentIndex || 0) + 1;
    if (window.saveProgress) await window.saveProgress();
    if(window.currentIndex < (window.scenarios || []).length){ setTimeout(window.loadScenario, 1200); }
    else { setTimeout(window.endGame, 800); }
  };

  window.DiagnosticEngine = DiagnosticEngine;
  console.log('DiagnosticEngine loaded');
})();

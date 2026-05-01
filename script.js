// Game + user state
let currentIndex = 0;
let score = 0;
let toolUses = 0;
const maxToolUses = 3;
let correctAnswers = 0;
let wrongAnswers = 0;
let totalToolUsed = 0;

let currentUser = null;
let userRole = 'student';
let schoolCode = '';

const scenarios = window.scenarios || [];
const total = scenarios.length;

// Firestore optional integration (CDN/global firebase)
let useFirestore = false;
let db = null;
if (window.firebase && window.firebaseConfig) {
  try {
    firebase.initializeApp(window.firebaseConfig);
    db = firebase.firestore();
    useFirestore = true;
    console.log('Firestore enabled');
  } catch (e) {
    console.warn('Firebase init failed, falling back to localStorage', e);
    useFirestore = false;
  }
}

function currentScenario(){
  return scenarios[currentIndex] || {symptoms:'No scenario', fault:null, tests:{}};
}

// Evidence state per scenario (reset on load)
let evidence = {
  electrical: [],
  fuel: [],
  ignition: [],
  air: [],
  ecu: [],
  engine: [],
  cooling: [],
  hvac: [],
  transmission: [],
  other: []
};

// pending diagnosis choice while user picks confidence via UI
let pendingDiagnosisChoice = null;

// selected system for the current scenario (must choose before using tools)
let selectedSystem = null;
// optional short justification entered by student when selecting a system
let systemJustification = '';
// last explanation object produced after diagnosis
let lastExplanation = null;

// system importance weights (used to bias evidence relevance after isolation)
const systemWeights = {
  electrical: 1.0,
  fuel: 1.0,
  ignition: 1.0,
  air: 0.9,
  ecu: 0.9,
  engine: 0.8,
  cooling: 0.8,
  hvac: 0.6,
  transmission: 0.6,
  other: 0.5
};

// Format tool outputs into a consistent technician-style report
function formatToolOutput(systemLabel, testName, value, interpretation, conclusion){
  return `[SYSTEM: ${systemLabel}]\nTest: ${testName}\nResult: ${value}\nInterpretation: ${interpretation}\nConclusion: ${conclusion}`;
}

// Lightweight fault probability model (priors initialized per scenario)
let faultProbabilities = {};

// Simple fault interaction model (keeps interactions small and explainable)
const faultInteractions = {
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

// Centralized evidence -> model update function
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
      // OBD codes strengthen ECU-related faults moderately
      faultProbabilities.ecu = (faultProbabilities.ecu || 0.5) + 0.15;
      break;
    default:
      break;
  }

  // Interaction propagation (small explainable boosts)
  Object.keys(faultInteractions).forEach(fault => {
    const inter = faultInteractions[fault];
    if (inter && inter.affects && inter.affects[component]){
      const effect = inter.affects[component];
      faultProbabilities[fault] = (faultProbabilities[fault] || 0.5) + (effect.probabilityBoost || 0);
    }
  });

  // clamp probabilities 0..1
  Object.keys(faultProbabilities).forEach(k => {
    faultProbabilities[k] = Math.max(0, Math.min(1, faultProbabilities[k]));
  });
}

// --- Student learning/profile memory (lightweight) ---
let studentProfile = {
  weakSystems: {},
  misconceptionMap: {},
  reasoningScoreHistory: []
};

function calculateReasoningScore(){
  let score = 0;
  try {
    if (systemJustification && systemJustification.length > 10) score += 3;
    if (lastExplanation && lastExplanation.topEvidence && lastExplanation.topEvidence.length) score += 2;
  } catch(e){}
  return score;
}

function updateStudentProfile(isCorrect, chosenSystem, correctSystem){
  if (!studentProfile) studentProfile = { weakSystems: {}, misconceptionMap: {}, reasoningScoreHistory: [] };
  if (!chosenSystem) chosenSystem = 'unknown';
  // track system weakness
  if (!studentProfile.weakSystems[chosenSystem]) studentProfile.weakSystems[chosenSystem] = 0;
  studentProfile.weakSystems[chosenSystem] += isCorrect ? 0 : 1;

  // track misconception pattern
  const key = `${chosenSystem}->${correctSystem || 'unknown'}`;
  if (!studentProfile.misconceptionMap[key]) studentProfile.misconceptionMap[key] = 0;
  studentProfile.misconceptionMap[key]++;

  // track reasoning trend
  const reasoningScore = calculateReasoningScore() || 0;
  studentProfile.reasoningScoreHistory.push(reasoningScore);
  // cap history length
  if (studentProfile.reasoningScoreHistory.length > 100) studentProfile.reasoningScoreHistory.shift();
}

function adaptNextScenarioDifficulty(){
  const entries = Object.entries(studentProfile.weakSystems || {});
  if (!entries.length) return null;
  entries.sort((a,b)=> b[1]-a[1]);
  const top = entries[0];
  if (top && top[1] > 2) return top[0];
  return null;
}

function getLearningInsightsForClass(classData){
  // aggregate weakest systems and misconceptions across class
  const aggWeak = {};
  const aggMis = {};
  const reasoningSamples = [];
  (classData || []).forEach(s => {
    const p = s.studentProfile || null;
    if (!p) return;
    Object.entries(p.weakSystems||{}).forEach(([k,v]) => { aggWeak[k] = (aggWeak[k]||0) + v; });
    Object.entries(p.misconceptionMap||{}).forEach(([k,v]) => { aggMis[k] = (aggMis[k]||0) + v; });
    if (p.reasoningScoreHistory && p.reasoningScoreHistory.length) reasoningSamples.push(p.reasoningScoreHistory.slice(-5));
  });
  const weakest = Object.entries(aggWeak).sort((a,b)=> b[1]-a[1])[0] || null;
  const topMis = Object.entries(aggMis).sort((a,b)=> b[1]-a[1])[0] || null;
  const reasoningTrend = reasoningSamples.length ? reasoningSamples.map(arr => arr.reduce((a,c)=>a+c,0)/arr.length) : [];
  return { weakestSystem: weakest, topMisconception: topMis, reasoningTrend };
}

// Conservative adaptive recommendation engine (teacher-facing only)
function getAdaptiveRecommendation(studentProfile = {}, classData = []){
  const weakSystems = studentProfile && studentProfile.weakSystems ? studentProfile.weakSystems : {};
  // choose student's recommended focus (highest error count)
  let recommendedSystem = null;
  let maxErr = 0;
  Object.entries(weakSystems).forEach(([sys, cnt]) => { if (cnt > maxErr){ maxErr = cnt; recommendedSystem = sys; } });
  if (!recommendedSystem) recommendedSystem = Object.keys(systemWeights)[0] || 'electrical';

  // aggregate class-level weakness
  const agg = {};
  (classData || []).forEach(s => {
    const p = (s && s.studentProfile && s.studentProfile.weakSystems) ? s.studentProfile.weakSystems : {};
    Object.entries(p).forEach(([k,v]) => { agg[k] = (agg[k]||0) + v; });
  });
  const classWideWeakSystem = Object.entries(agg).sort((a,b)=> b[1]-a[1])[0]?.[0] || recommendedSystem;

  // suggested difficulty: conservative mapping
  // more errors -> suggest lower difficulty to rebuild fundamentals (1 easiest -> 5 hardest)
  const suggestedDifficulty = (maxErr >= 6) ? 1 : (maxErr >= 4) ? 2 : (maxErr >= 2) ? 3 : 4;

  const reason = `Repeated errors observed in ${recommendedSystem}. Class-level weakness: ${classWideWeakSystem}.`;

  return {
    recommendedSystem,
    classWideWeakSystem,
    suggestedDifficulty,
    reason
  };
}

// Curriculum-aware scenario recommendation engine (teacher-facing)
function getScenarioRecommendations(classData = [], scenariosList = []){
  const systemWeakness = {};
  const difficultyWeakness = {};

  (classData || []).forEach(student => {
    const profile = student.studentProfile || {};
    Object.entries(profile.weakSystems || {}).forEach(([sys, val]) => {
      systemWeakness[sys] = (systemWeakness[sys] || 0) + val;
    });

    // fallback: use explanations to infer difficulty errors if runHistory absent
    (student.explanations || []).forEach(ex => {
      const scen = (typeof ex.scenarioIndex === 'number' && scenarios[ex.scenarioIndex]) ? scenarios[ex.scenarioIndex] : null;
      const d = scen && scen.difficulty ? scen.difficulty : 2;
      difficultyWeakness[d] = (difficultyWeakness[d] || 0) + (ex.final === 'Correct' ? 0 : 1);
    });
  });

  const focusSystem = Object.entries(systemWeakness).sort((a,b)=> b[1]-a[1])[0]?.[0] || Object.keys(systemWeights)[0] || 'electrical';
  const worstDifficulty = Object.entries(difficultyWeakness).sort((a,b)=> b[1]-a[1])[0]?.[0] || 2;

  const minDiff = Math.max(1, parseInt(worstDifficulty));
  const maxDiff = Math.min(5, minDiff + 1);

  const recommended = (scenariosList || []).filter(s => s.primarySystem === focusSystem && s.difficulty >= minDiff && s.difficulty <= maxDiff).slice(0,3);

  return {
    focusSystem,
    difficultyBand: `${minDiff}-${maxDiff}`,
    recommendedScenarios: recommended,
    reason: `Class shows concentrated errors in ${focusSystem} within difficulty ${minDiff}-${maxDiff}`
  };
}

function renderScenarioRecommendations(classData = [], scenariosList = []){
  // load any current assignment to highlight if present
  const classAssignment = JSON.parse(localStorage.getItem('carSim_assignment') || 'null');
  const rec = getScenarioRecommendations(classData, scenariosList);
  const container = document.getElementById('teacherRecommendations');
  if (!container) return;
  container.style.display = 'block';
  let html = `<h3>Recommended Training Scenarios</h3>`;
  html += `<div><strong>Focus system:</strong> ${rec.focusSystem}</div>`;
  html += `<div><strong>Difficulty band:</strong> ${rec.difficultyBand}</div>`;
  html += `<div style="margin-bottom:8px;font-style:italic;color:var(--muted,#999)">${rec.reason}</div>`;
  if (!rec.recommendedScenarios || rec.recommendedScenarios.length === 0) html += `<div>No matching scenarios found for the current focus/difficulty.</div>`;
  else {
    rec.recommendedScenarios.forEach(s => {
      const assigned = classAssignment && classAssignment.activeScenario && String(classAssignment.activeScenario) === String(s.id);
      html += `<div style="margin:6px 0;padding:8px;border:1px solid ${assigned ? 'rgba(100,200,100,0.7)' : 'rgba(255,255,255,0.04)'};background:${assigned ? 'linear-gradient(90deg, rgba(100,200,100,0.06), rgba(255,255,255,0.01))' : 'rgba(255,255,255,0.01)'}">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;"><div><strong>Scenario ${s.id}</strong><div style="font-size:90%">${s.symptoms}</div>${s.trainingFocus?`<div style=\"font-size:85%;color:var(--muted,#999)\">${s.trainingFocus}</div>`:''}</div>`;
      html += `<div style="display:flex;gap:6px"><button onclick="showScenarioPreview('${s.id}')">Preview</button><button onclick="assignScenarioToClass('${s.id}')">Assign to Class</button></div></div>`;
      html += `</div>`;
    });
  }
  container.innerHTML = html;
}

// Helper: find scenario by id (flexible matching)
function findScenarioById(id){
  if (!scenarios || !id) return null;
  // try strict id match
  let s = scenarios.find(ss => ss.id === id || String(ss.id) === String(id));
  if (s) return s;
  // try numeric index (id may be 1-based index)
  const asNum = parseInt(id);
  if (!isNaN(asNum) && scenarios[asNum - 1]) return scenarios[asNum - 1];
  return scenarios.find(ss => String(ss.index) === String(id)) || null;
}

function showScenarioPreview(id){
  const scen = findScenarioById(id);
  const modal = document.getElementById('scenarioPreviewModal');
  if (!modal) return alert('Preview unavailable');
  document.getElementById('preview-title').innerText = `Scenario ${scen && scen.id ? scen.id : id} Preview`;
  document.getElementById('preview-meta').innerText = scen ? `Difficulty: ${scen.difficulty || 'N/A'} — Primary: ${scen.primarySystem || 'N/A'}` : '';
  document.getElementById('preview-symptoms').innerText = scen ? scen.symptoms || '' : 'No data';
  const stepsEl = document.getElementById('preview-steps');
  stepsEl.innerHTML = '';
  if (scen && scen.steps && scen.steps.length){
    scen.steps.forEach((st, i) => {
      const d = document.createElement('div');
      d.style.padding = '6px 0';
      d.innerHTML = `<strong>Step ${i+1}:</strong> ${st.description || st.instruction || ''} <div style='font-size:90%; color:var(--muted,#aaa)'>Expected: ${st.expectedOutcome || '—'}</div>`;
      stepsEl.appendChild(d);
    });
  } else {
    stepsEl.innerHTML = '<div style="color:var(--muted,#999)">No procedural steps defined for this scenario.</div>';
  }
  // wire assign button
  const assignBtn = document.getElementById('preview-assign');
  assignBtn.onclick = () => { assignScenarioToClass(id); };
  const closeBtn = document.getElementById('preview-close');
  closeBtn.onclick = () => { closeScenarioPreview(); };
  modal.style.display = 'flex';
}

function closeScenarioPreview(){
  const modal = document.getElementById('scenarioPreviewModal');
  if (modal) modal.style.display = 'none';
}

function assignScenarioToClass(id){
  const scen = findScenarioById(id);
  const assignment = { activeScenario: id, assignedTo: 'class', assignedAt: new Date().toISOString(), metadata: { difficulty: scen && scen.difficulty, primarySystem: scen && scen.primarySystem } };
  localStorage.setItem('carSim_assignment', JSON.stringify(assignment));
  // show confirmation in teacherDecisions
  const dec = document.getElementById('teacherDecisions');
  if (dec) {
    dec.style.display = 'block';
    dec.innerHTML = `
      <h3>Assignment</h3>
      <div>Assigned scenario <strong>${id}</strong> to the class.</div>
      <div style="font-size:90%;color:var(--muted,#999)">Assigned at ${assignment.assignedAt}</div>
    `;
  }
  // refresh recommendations to highlight assignment
  try { renderScenarioRecommendations(JSON.parse(localStorage.getItem('carSim_class')||'[]'), scenarios || []); } catch(e){}
  // close preview modal if open
  closeScenarioPreview();
}


async function saveProgress(){
  if (!currentUser) return;

  const student = {
    name: currentUser,
    score,
    correct: correctAnswers,
    wrong: wrongAnswers,
    currentLevel: currentIndex,
    selectedSystem,
    lastExplanation: lastExplanation || null,
    studentProfile: studentProfile || {},
    completed: currentIndex >= scenarios.length,
    lastUpdated: new Date().toISOString()
  };

  if (useFirestore && db) {
    try {
      await db.collection('students').doc(currentUser).set(student);
      return;
    } catch (e) {
      console.warn('Failed to save to Firestore, saving locally', e);
    }
  }

  localStorage.setItem('carSim_' + currentUser, JSON.stringify(student));
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const existingIndex = classData.findIndex(s => s.name === currentUser);
  // preserve and append explanations history per student
  const existing = (existingIndex >= 0) ? classData[existingIndex] : null;
  student.explanations = existing && existing.explanations ? existing.explanations.slice() : [];
  if (lastExplanation) {
    const lastSaved = student.explanations.length ? student.explanations[student.explanations.length - 1] : null;
    if (!lastSaved || lastSaved.scenarioIndex !== lastExplanation.scenarioIndex) {
      // add timestamp and store a copy
      const copy = Object.assign({}, lastExplanation, { savedAt: new Date().toISOString() });
      student.explanations.push(copy);
    }
  }
  if (existingIndex >= 0) classData[existingIndex] = student;
  else classData.push(student);
  localStorage.setItem('carSim_class', JSON.stringify(classData));
}

async function loadUserData(){
  if (!currentUser) return;
  if (useFirestore && db) {
    try {
      const doc = await db.collection('students').doc(currentUser).get();
      if (doc.exists) {
        const data = doc.data();
        score = data.score || 0;
        correctAnswers = data.correct || 0;
        wrongAnswers = data.wrong || 0;
        currentIndex = data.currentLevel || 0;
        selectedSystem = data.selectedSystem || null;
        return;
      }
    } catch (e) {
      console.warn('Failed to load from Firestore', e);
    }
  }

  const saved = JSON.parse(localStorage.getItem('carSim_' + currentUser));
  if (!saved) return;
  score = saved.score || 0;
  correctAnswers = saved.correct || 0;
  wrongAnswers = saved.wrong || 0;
  currentIndex = saved.currentLevel || 0;
  selectedSystem = saved.selectedSystem || null;
  // restore student profile if present
  studentProfile = saved.studentProfile || studentProfile || { weakSystems: {}, misconceptionMap: {}, reasoningScoreHistory: [] };
}

function loadScenario(){
  const s = currentScenario();
  // reset per-scenario evidence and counters
  evidence = { electrical:[], fuel:[], ignition:[], air:[], ecu:[], engine:[], cooling:[], hvac:[], transmission:[], other:[] };
  toolUses = 0;
  selectedSystem = null;
  // initialize lightweight fault probability priors for this scenario
  faultProbabilities = {
    battery: 0.5,
    starter: 0.5,
    fuel: 0.5,
    ecu: 0.5,
    ignition: 0.5
  };
  document.getElementById('symptoms').innerText = s.symptoms;
  document.getElementById('result').innerText = '';
  document.getElementById('progress').innerText = `Scenario ${currentIndex + 1} of ${total}`;
  document.getElementById('score').innerText = `Score: ${score}`;
  document.getElementById('toolsLeft').innerText = `Tools left: ${maxToolUses - toolUses}`;
  const dl = document.getElementById('download-report');
  if (dl) dl.style.display = 'none';
  document.getElementById('userInfo').innerText = currentUser ? `Student: ${currentUser}` : '';

  // show system isolation panel and guide student
  const sp = document.getElementById('systemPanel');
  if (sp) sp.style.display = 'block';
  const conf = document.getElementById('confidencePanel');
  if (conf) conf.style.display = 'none';
}

function check(component){
  const s = currentScenario();
  if (!selectedSystem) {
    document.getElementById('result').innerText = '🔎 Please select the suspected SYSTEM first.';
    return;
  }

  if(toolUses >= maxToolUses){
    document.getElementById('result').innerText = '⚠️ No tool uses left!';
    return;
  }

  toolUses++;
  totalToolUsed++;
  // Build structured evidence from scenario tests
  const raw = (s.tests && s.tests[component]);
  let output = { system: 'other', reading: 'No data', interpretation: 'UNKNOWN', source: component };
  if (raw) {
    if (typeof raw === 'string') {
      // backward compatible: simple string -> wrap
      output.reading = raw;
      const txt = raw.toLowerCase();
      if (txt.includes('low') || txt.includes('no pressure') || txt.includes('no fuel') || txt.includes('<12v') || txt.includes('0 psi')) output.interpretation = 'PROBLEM';
      else output.interpretation = 'OK';
      // basic system mapping
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

  // store evidence
  if (!evidence[output.system]) evidence[output.system] = [];
  // attach the student's justification/rationale for this isolation (if any)
  output.justification = systemJustification || '';
  // compute adaptive weight: base by system importance, boost if matches selected system, boost if interpretation indicates problem
  const baseImportance = systemWeights[output.system] || 0.5;
  const isolationBoost = (selectedSystem && selectedSystem === output.system) ? 1.2 : 1.0;
  const problemBoost = (/problem|low|no|<12v|0 psi|leak|misfire/i.test(output.reading + ' ' + output.interpretation)) ? 1.4 : 1.0;
  output.weight = +(baseImportance * isolationBoost * problemBoost).toFixed(2);
  evidence[output.system].push(output);

  // annotate evidence with current selected system context
  output.contextSystem = selectedSystem || 'unspecified';

  // apply evidence into the lightweight probabilistic model
  try { applyEvidenceToModel(component, output.interpretation || output.reading || ''); } catch(e){ /* safe fallback */ }

  // display shop-style evidence message (more realistic phrasing)
  // standardized technician-style output
  const systemMap = { battery: 'Electrical', starter: 'Starting', fuel: 'Fuel Delivery', obd: 'On-Board Diagnostics' };
  const systemLabel = systemMap[component] || (output.system ? output.system.charAt(0).toUpperCase() + output.system.slice(1) : 'General System');
  const interpretationText = (output.interpretation && /PROBLEM|problem|LOW|low|NO|no|<12v|0 psi|LEAK|leak/i.test(output.reading + ' ' + output.interpretation)) ? 'Below normal operating range' : 'Within expected range';
  let conclusion = 'No immediate fault indicated';
  if (/low|no pressure|<12v|0 psi|leak|stuck|sticky|slipping|slip|misfire|clog/i.test(output.reading + ' ' + output.interpretation)) {
    conclusion = 'Potential issue detected; follow-up testing recommended';
  }
  const formatted = formatToolOutput(systemLabel, component.toUpperCase() + ' TEST', output.reading, interpretationText, conclusion);
  document.getElementById('result').innerText = formatted + (systemJustification ? `\n\nReason for isolation: ${systemJustification}` : '');
  // append ranked diagnostic likelihoods (top 3)
  try {
    if (faultProbabilities && Object.keys(faultProbabilities).length) {
      const ranked = Object.entries(faultProbabilities).sort((a,b)=> b[1]-a[1]).slice(0,3);
      const lines = ranked.map(f => `- ${f[0]}: ${Math.round(f[1]*100)}%`);
      document.getElementById('result').innerText += `\n\n📊 Diagnostic Likelihoods:\n${lines.join('\n')}`;
      // ambiguous hint example: starter symptoms may be driven by battery
      if (component === 'starter' && (faultProbabilities.battery || 0) > 0.6) {
        document.getElementById('result').innerText += `\n\n⚠️ Note: Starter symptoms may be ambiguous — battery condition is currently likely (${Math.round((faultProbabilities.battery||0)*100)}%).`;
      }
    }
  } catch(e){ /* ignore readout errors */ }
  if(toolUses > 2){
    score = Math.max(0, score - 2);
    document.getElementById('score').innerText = `Score: ${score}`;
  }
  document.getElementById('toolsLeft').innerText = `Tools left: ${maxToolUses - toolUses}`;
  saveProgress();
}

function selectSystem(sys){
  selectedSystem = sys;
  // capture optional short justification from the UI input
  try { systemJustification = (document.getElementById('systemReason') && document.getElementById('systemReason').value) ? document.getElementById('systemReason').value.trim() : ''; } catch(e){ systemJustification = ''; }
  const panel = document.getElementById('systemPanel');
  if (panel) panel.style.display = 'none';
  document.getElementById('result').innerText = `🔧 System selected: ${sys.toUpperCase()}. Now use tools to gather evidence.`;
  // small hint: show confidence panel only after diagnosis; ensure it's hidden
  const conf = document.getElementById('confidencePanel');
  if (conf) conf.style.display = 'none';
  // record selection in evidence as a starting note (include student rationale)
  if (!evidence[sys]) evidence[sys] = [];
  evidence[sys].push({ system: sys, reading: 'SYSTEM ISOLATION', interpretation: 'SELECTED', source: 'systemSelection', weight: (systemWeights[sys] || 0.5), justification: systemJustification });
  saveProgress();
}

async function diagnose(choice){
  // Show confidence UI instead of prompt
  pendingDiagnosisChoice = choice;
  const panel = document.getElementById('confidencePanel');
  if (panel) panel.style.display = 'block';
}

// Apply diagnosis after user selects confidence via UI
async function applyDiagnosisWithConfidence(conf){
  const choice = pendingDiagnosisChoice;
  pendingDiagnosisChoice = null;
  const s = currentScenario();
  const out = document.getElementById('result');
  const confScore = conf === 'high' ? 10 : (conf === 'medium' ? 6 : 3);

  // Simple evidence-based evaluation (same heuristics)
  let correct = false;
  const sys = (choice === 'battery' || choice === 'starter' || choice === 'alternator') ? 'electrical'
            : (choice === 'fuel' ? 'fuel' : (choice === 'spark' || choice === 'spark_plugs' ? 'ignition' : null));

  if (sys && evidence[sys] && evidence[sys].length > 0) {
    // compute weighted relevance for the candidate system
    const evidenceSum = evidence[sys].reduce((a,c)=> a + (c.weight || 0), 0);
    const totalSum = Object.keys(evidence).reduce((a,k)=> a + (evidence[k]||[]).reduce((x,y)=> x + (y.weight||0), 0), 0) || 1;
    const relevance = evidenceSum / totalSum; // 0..1 ratio for how much evidence supports this system

    const problematic = evidence[sys].some(e => /low|no|problem|leak|slip|misfire|degrad|sticky|clog|<12v|0 psi/i.test(e.reading + ' ' + e.interpretation));

    // Decide correctness using fault match and evidence relevance. If student isolated correctly, allow lower thresholds.
    const faultMatch = (s.fault && s.fault.includes(choice));
    const isolationCorrect = selectedSystem === sys;

    if (faultMatch && (relevance >= 0.2 || isolationCorrect || problematic)) correct = true;
    else correct = false;
  } else {
    correct = (choice === s.fault);
  }

  if (correct) {
    correctAnswers++;
    // reward confidence + isolation bonus
    const isolationBonus = selectedSystem ? (selectedSystem === sys ? 2 : -2) : 0;
    score += confScore + isolationBonus;
    out.innerText = `✅ Correct diagnosis based on evidence (+${confScore + (isolationBonus>0?isolationBonus:0)} pts)`;
  } else {
    wrongAnswers++;
    score = Math.max(0, score - 5);
    out.innerText = `❌ Incorrect diagnosis (-5 pts)`;
  }
  document.getElementById('score').innerText = `Score: ${score}`;

  // Build explanation object and render explanation panel for teacher/student transparency
  try {
    const evidenceSum = (sys && evidence[sys]) ? evidence[sys].reduce((a,c)=> a + (c.weight || 0), 0) : 0;
    const totalSum = Object.keys(evidence).reduce((a,k)=> a + (evidence[k]||[]).reduce((x,y)=> x + (y.weight||0), 0), 0) || 1;
    const relevance = totalSum ? (evidenceSum / totalSum) : 0;
    const isolationCorrect = selectedSystem === sys;
    const topEvidence = (sys && evidence[sys]) ? (evidence[sys].slice().sort((a,b)=> (b.weight||0)-(a.weight||0)).slice(0,3).map(e=>({reading:e.reading, interpretation:e.interpretation, weight:e.weight, source:e.source}))) : [];
    const isolationBonus = selectedSystem ? (selectedSystem === sys ? 2 : -2) : 0;
    lastExplanation = {
      selectedSystem: selectedSystem || null,
      diagnosedSystem: sys || null,
      systemRationale: systemJustification || '',
      relevance: +relevance.toFixed(2),
      evidenceSum: +evidenceSum.toFixed(2),
      totalSum: +totalSum.toFixed(2),
      topEvidence,
      isolationCorrect,
      confidence: conf,
      scoreDelta: correct ? (confScore + isolationBonus) : -5,
      final: correct ? 'Correct' : 'Incorrect',
      scenarioIndex: currentIndex
    };

    // update student learning profile (remember across sessions)
    try {
      const isCorrect = (lastExplanation.final === 'Correct');
      updateStudentProfile(isCorrect, selectedSystem || 'unspecified', s.fault || null);
    } catch(e) { console.warn('Failed to update student profile', e); }

    // render into DOM
    const panel = document.getElementById('explanationPanel');
    if (panel) panel.style.display = 'block';
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    setText('exp-system', lastExplanation.selectedSystem || '—');
    setText('exp-rationale', lastExplanation.systemRationale || '—');
    setText('exp-relevance', Math.round(lastExplanation.relevance * 100) + '%');
    setText('exp-isolation', lastExplanation.isolationCorrect ? 'Correct' : 'Incorrect');
    setText('exp-confidence', lastExplanation.confidence);
    // technician reasoning summary (simple natural language synthesis of top evidence)
    const reasoningEl = document.getElementById('exp-reasoning');
    if (reasoningEl) {
      if (lastExplanation.topEvidence && lastExplanation.topEvidence.length) {
        const s = lastExplanation.topEvidence.map(e => `${e.reading} (${e.interpretation})`).join('; ');
        reasoningEl.innerText = `Technician reasoning: observed ${s}.`;
      } else {
        reasoningEl.innerText = 'Technician reasoning: No system-specific evidence collected.';
      }
    }
    const evidEl = document.getElementById('exp-evidence');
    if (evidEl) {
      evidEl.innerHTML = '';
      if (lastExplanation.topEvidence.length === 0) evidEl.innerHTML = '<div class="evidence-entry">(no system-specific evidence collected)</div>';
      lastExplanation.topEvidence.forEach(ev => {
        const d = document.createElement('div');
        d.className = 'evidence-entry';
        d.innerText = `${ev.reading} — ${ev.interpretation} (w:${ev.weight})`;
        evidEl.appendChild(d);
      });
    }
    setText('exp-final', `Result: ${lastExplanation.final}. Score change: ${lastExplanation.scoreDelta}`);
  } catch (e) {
    console.warn('Failed to build explanation', e);
  }

  // show evidence summary
  const summary = [];
  Object.keys(evidence).forEach(k => {
    if (evidence[k] && evidence[k].length) summary.push(`${k}: ${evidence[k].map(e=>e.reading + ' ('+e.interpretation+')').join('; ')}`);
  });
  if (summary.length) out.innerText += '\n\nEvidence:\n' + summary.join('\n');

  // hide confidence panel
  const panel = document.getElementById('confidencePanel');
  if (panel) panel.style.display = 'none';

  currentIndex++;
  await saveProgress();
  if(currentIndex < scenarios.length){
    setTimeout(loadScenario, 1200);
  } else {
    setTimeout(endGame, 800);
  }

function nextScenario(){
  if(currentIndex < scenarios.length - 1) currentIndex++;
  else currentIndex = 0;
  loadScenario();
}

async function endGame(){
  const accuracy = Math.round((correctAnswers / total) * 100) || 0;
  const efficiency = Math.max(0, 100 - (totalToolUsed * 5));
  let grade = 'C';
  if (accuracy > 90 && efficiency > 80) grade = 'A';
  else if (accuracy > 75) grade = 'B';
  else if (accuracy > 60) grade = 'C';
  else grade = 'D';

  document.getElementById('symptoms').innerText = 'Assessment Complete';
  document.getElementById('result').innerHTML = `Final Score: ${score} <br>Accuracy: ${accuracy}% <br>Efficiency: ${efficiency}% <br>Grade: ${grade}`;
  document.getElementById('progress').innerText = '';
  const dl = document.getElementById('download-report');
  if (dl) dl.style.display = 'inline-block';
  await saveProgress();
}

function downloadReport(){
  const report = `Car Diagnosis Report\n\nName: ${currentUser || 'N/A'}\nScore: ${score}\nCorrect: ${correctAnswers}\nWrong: ${wrongAnswers}\nTool Uses: ${totalToolUsed}\n`;
  const blob = new Blob([report], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'car-diagnosis-report.txt';
  link.click();
}

async function login(){
  const name = document.getElementById('username').value.trim();
  const role = document.getElementById('role').value;
  const code = document.getElementById('schoolCode').value.trim();
  if(!name){ alert('Please enter a name'); return; }
  currentUser = name;
  userRole = role;
  schoolCode = code;

  document.getElementById('loginScreen').style.display = 'none';
  if(userRole === 'teacher'){
    document.getElementById('teacherScreen').style.display = 'block';
    await loadTeacherData();
  } else {
    document.getElementById('gameScreen').style.display = 'block';
    await loadUserData();
    loadScenario();
  }
}

function logout(){
  currentUser = null;
  userRole = 'student';
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('teacherScreen').style.display = 'none';
}

async function loadTeacherData(){
  const container = document.getElementById('studentList');
  container.innerHTML = '';
  if (useFirestore && db) {
    try {
      const snapshot = await db.collection('students').get();
      if (snapshot.empty) { container.innerHTML = '<p>No student data yet.</p>'; return; }
      snapshot.forEach(doc => {
        const s = doc.data();
        container.innerHTML += `
          <div style="border:1px solid rgba(255,255,255,0.06); padding:10px; margin:8px; background:rgba(255,255,255,0.01)">
            <h3>${s.name}</h3>
            <p>Score: ${s.score}</p>
            <p>Accuracy: ${s.correct} / ${s.correct + s.wrong}</p>
            <p>Level: ${s.currentLevel + 1}/${total}</p>
            <p>Status: ${s.completed ? 'Completed' : 'In Progress'}</p>
            <p>Last: ${s.lastUpdated || '—'}</p>
            <p>Explanations: ${s.explanations ? s.explanations.length : 0}</p>
          </div>
        `;
      });
      return;
    } catch (e) {
      console.warn('Failed to load teacher data from Firestore', e);
    }
  }

  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  if (classData.length === 0){ container.innerHTML = '<p>No student data yet.</p>'; return; }
  container.innerHTML = classData.map(s => `
    <div style="border:1px solid rgba(255,255,255,0.06); padding:10px; margin:8px; background:rgba(255,255,255,0.01)">
      <h3>${s.name}</h3>
      <p>Score: ${s.score}</p>
      <p>Accuracy: ${s.correct} / ${s.correct + s.wrong}</p>
      <p>Level: ${s.currentLevel + 1}/${total}</p>
      <p>Status: ${s.completed ? 'Completed' : 'In Progress'}</p>
      <p>Last: ${s.lastUpdated || '—'}</p>
      <p>Explanations: ${s.explanations ? s.explanations.length : 0}</p>
    </div>
  `).join('');
}

async function exportAll(){
  if (useFirestore && db) {
    try {
      const snapshot = await db.collection('students').get();
      const arr = [];
      snapshot.forEach(doc => arr.push(doc.data()));
      const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'carSim_class_export.json';
      link.click();
      return;
    } catch (e) {
      console.warn('Failed to export from Firestore', e);
    }
  }
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  // include per-student explanations if present (already persisted in saveProgress)
  const blob = new Blob([JSON.stringify(classData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'carSim_class_export.json';
  link.click();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-battery').addEventListener('click', () => check('battery'));
  document.getElementById('btn-starter').addEventListener('click', () => check('starter'));
  document.getElementById('btn-fuel').addEventListener('click', () => check('fuel'));
  document.getElementById('btn-obd').addEventListener('click', () => check('obd'));

  document.getElementById('diag-battery').addEventListener('click', () => diagnose('battery'));
  document.getElementById('diag-starter').addEventListener('click', () => diagnose('starter'));
  document.getElementById('diag-fuel').addEventListener('click', () => diagnose('fuel'));
  document.getElementById('diag-spark').addEventListener('click', () => diagnose('spark'));

  document.getElementById('next').addEventListener('click', nextScenario);
  const dl = document.getElementById('download-report');
  if (dl) dl.addEventListener('click', downloadReport);

  document.getElementById('btn-enter').addEventListener('click', () => login());
  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('teacherScreen').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
  });
  document.getElementById('btn-refresh').addEventListener('click', () => loadTeacherData());
  document.getElementById('btn-export').addEventListener('click', () => exportAll());

  // Start overlay handlers
  const start = document.getElementById('btn-start');
  if (start) start.addEventListener('click', () => {
    const o = document.getElementById('startOverlay');
    if (o) o.style.display = 'none';
    const login = document.getElementById('loginScreen');
    if (login) login.style.display = 'block';
    const u = document.getElementById('username'); if (u) u.focus();
  });
  const skip = document.getElementById('btn-skip');
  if (skip) skip.addEventListener('click', () => {
    const o = document.getElementById('startOverlay');
    if (o) o.style.display = 'none';
    const login = document.getElementById('loginScreen');
    if (login) login.style.display = 'block';
  });

  // confidence button handlers
  const ch = document.getElementById('conf-high');
  const cm = document.getElementById('conf-medium');
  const cl = document.getElementById('conf-low');
  if (ch) ch.addEventListener('click', () => applyDiagnosisWithConfidence('high'));
  if (cm) cm.addEventListener('click', () => applyDiagnosisWithConfidence('medium'));
  if (cl) cl.addEventListener('click', () => applyDiagnosisWithConfidence('low'));

  // system selection handlers
  const se = document.getElementById('sys-electrical'); if (se) se.addEventListener('click', () => selectSystem('electrical'));
  const sf = document.getElementById('sys-fuel'); if (sf) sf.addEventListener('click', () => selectSystem('fuel'));
  const si = document.getElementById('sys-ignition'); if (si) si.addEventListener('click', () => selectSystem('ignition'));
  const sa = document.getElementById('sys-air'); if (sa) sa.addEventListener('click', () => selectSystem('air'));
  const sc = document.getElementById('sys-ecu'); if (sc) sc.addEventListener('click', () => selectSystem('ecu'));
  const so = document.getElementById('sys-other'); if (so) so.addEventListener('click', () => selectSystem('other'));

  // teacher CSV export for explanations
  const be = document.getElementById('btn-export-explanations');
  if (be) be.addEventListener('click', () => exportExplanationsCSV());
  const bi = document.getElementById('btn-insights');
  if (bi) bi.addEventListener('click', () => renderTeacherInsights());
});

function escapeCSV(val){
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return '"' + s + '"';
}

function exportExplanationsCSV(){
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const rows = [];
  const header = ['Student','ScenarioIndex','ScenarioSymptoms','Fault','SelectedSystem','DiagnosedSystem','IsolationCorrect','Confidence','ScoreDelta','TopEvidence','SavedAt'];
  rows.push(header.map(escapeCSV).join(','));

  classData.forEach(student => {
    const name = student.name || 'Unknown';
    const explanations = student.explanations || [];
    explanations.forEach(ex => {
      const scen = (typeof ex.scenarioIndex === 'number' && scenarios[ex.scenarioIndex]) ? scenarios[ex.scenarioIndex] : null;
      const symptoms = scen ? (scen.symptoms || '') : '';
      const fault = scen ? (scen.fault || '') : '';
      const topEv = (ex.topEvidence || []).map(e => `${e.reading} (${e.interpretation})`).join(' | ');
      const row = [
        name,
        ex.scenarioIndex,
        symptoms,
        fault,
        ex.selectedSystem,
        ex.diagnosedSystem,
        ex.isolationCorrect,
        ex.confidence,
        ex.scoreDelta,
        topEv,
        ex.savedAt || ''
      ];
      rows.push(row.map(escapeCSV).join(','));
    });
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'carSim_explanations_export.csv';
  link.click();
}

// --- Teacher Insights / Summary (compact, aggregated) ---
function faultToSystem(fault){
  if (!fault) return 'other';
  const f = String(fault).toLowerCase();
  if (f.includes('battery') || f.includes('starter') || f.includes('alternator')) return 'electrical';
  if (f.includes('fuel')) return 'fuel';
  if (f.includes('spark') || f.includes('ignit') || f.includes('spark_plug')) return 'ignition';
  if (f.includes('ecu') || f.includes('obd')) return 'ecu';
  if (f.includes('air')) return 'air';
  return 'other';
}

function computeClassSummary(){
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const summary = {
    totalStudents: classData.length,
    avgScore: 0,
    avgAccuracy: 0,
    avgConfidence: 0,
    mostCommonMisdiagnosedSystem: null,
    skillProfiles: {},
    isolationAccuracy: 0,
    commonConfusions: [],
    students: [],
    calibration: { highTotal:0, highCorrect:0, calibrationPct:0 },
    examples: { confusionExamples: [], skillExamples: [], calibrationExamples: [] }
  };
  if (classData.length === 0) return summary;

  let scoreSum = 0; let accSum = 0; let confSum = 0; let confCount = 0; let explanationCount = 0;
  const miscount = {}; // diagnosedSystem -> count when wrong
  const confusionPairs = {}; // expected|diagnosed -> count
  const perSystem = {}; // system -> {correct:0,total:0}
  const isolationCorrectCount = {ok:0, total:0};
  const calibrationCounts = { highTotal:0, highCorrect:0 };

  classData.forEach(student => {
    scoreSum += (student.score || 0);
    const exs = student.explanations || [];
    explanationCount += exs.length;
    let studentProfile = { name: student.name || 'Unknown', score: student.score || 0, explanations: exs.length, weakest: null };

    // per-student per-system counts for weakest
    const sp = {};
    exs.forEach(ex => {
      const scen = (typeof ex.scenarioIndex === 'number' && scenarios[ex.scenarioIndex]) ? scenarios[ex.scenarioIndex] : null;
      const expected = faultToSystem(scen && scen.fault);
      const diagnosed = ex.diagnosedSystem || 'other';
      // accumulate perSystem
      if (!perSystem[expected]) perSystem[expected] = { correct:0, total:0 };
      if (!sp[expected]) sp[expected] = { correct:0, total:0 };
      perSystem[expected].total++; sp[expected].total++;
      if (ex.final === 'Correct') { perSystem[expected].correct++; sp[expected].correct++; }

      // confidence
      if (ex.confidence) { confSum += (ex.confidence === 'high' ? 1 : (ex.confidence === 'medium' ? 0.66 : 0.33)); confCount++; }
      // calibration counts: record high-confidence correctness
      if (ex.confidence === 'high'){
        calibrationCounts.highTotal++;
        if (ex.final === 'Correct') calibrationCounts.highCorrect++;
        // keep short example for calibration
        if (calibrationCounts.highTotal <= 6) summary.examples.calibrationExamples.push({ student: student.name || 'Unknown', scenarioIndex: ex.scenarioIndex, final: ex.final, diagnosed: ex.diagnosedSystem, selectedSystem: ex.selectedSystem, topEvidence: ex.topEvidence });
      }

      // isolation
      isolationCorrectCount.total++; if (ex.isolationCorrect) isolationCorrectCount.ok++;

      // confusion pair
      if (diagnosed !== expected){
        const key = `${expected}→${diagnosed}`;
        confusionPairs[key] = (confusionPairs[key] || 0) + 1;
        miscount[diagnosed] = (miscount[diagnosed] || 0) + 1;
        // add example for this confusion pair (up to 4 examples)
        if ((summary.examples.confusionExamples.filter(x=>x.pair===key).length || 0) < 4) {
          summary.examples.confusionExamples.push({ pair: key, student: student.name || 'Unknown', scenarioIndex: ex.scenarioIndex, expected, diagnosed, final: ex.final, topEvidence: ex.topEvidence });
        }
      }
    });

    // student weakest system
    let weakest = null; let weakestRate = 1;
    Object.keys(sp).forEach(sys => {
      const t = sp[sys].total || 0; if (!t) return;
      const rate = 1 - (sp[sys].correct || 0) / t;
      if (rate > weakestRate) { weakestRate = rate; weakest = sys; }
    });
    studentProfile.weakest = weakest || 'N/A';
    summary.students.push(studentProfile);
  });

  // aggregate metrics
  summary.avgScore = +(scoreSum / classData.length).toFixed(1);
  // overall accuracy from perSystem totals
  let totalCorrect = 0; let totalAttempts = 0;
  Object.keys(perSystem).forEach(k => { totalCorrect += perSystem[k].correct; totalAttempts += perSystem[k].total; });
  summary.avgAccuracy = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  summary.avgConfidence = confCount ? +(confSum / confCount).toFixed(2) : 0;
  summary.isolationAccuracy = isolationCorrectCount.total ? Math.round((isolationCorrectCount.ok / isolationCorrectCount.total) * 100) : 0;

  // calibration summary
  summary.calibration.highTotal = calibrationCounts.highTotal;
  summary.calibration.highCorrect = calibrationCounts.highCorrect;
  summary.calibration.calibrationPct = calibrationCounts.highTotal ? Math.round((calibrationCounts.highCorrect / calibrationCounts.highTotal) * 100) : 0;

  // most common misdiagnosed
  let max = 0; let common = null;
  Object.keys(miscount).forEach(k => { if (miscount[k] > max){ max = miscount[k]; common = k; } });
  summary.mostCommonMisdiagnosedSystem = common || 'None';

  // confusions top 5
  const pairs = Object.keys(confusionPairs).map(k => ({pair:k,count:confusionPairs[k]})).sort((a,b)=> b.count - a.count).slice(0,6);
  summary.commonConfusions = pairs;

  // skill profiles
  Object.keys(systemWeights).forEach(sys => {
    const stat = perSystem[sys] || {correct:0,total:0};
    const pct = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
    summary.skillProfiles[sys] = pct;
  });

  return summary;
}

function renderTeacherInsights(){
  const panel = document.getElementById('teacherSummaryPanel');
  if (!panel) return;
  const s = computeClassSummary();
  panel.style.display = 'block';
  panel.innerHTML = '';

  // Top-level summary (3-5 metrics)
  const top = document.createElement('div');
  top.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap">
      <div><strong>Total students:</strong> ${s.totalStudents}</div>
      <div><strong>Average score:</strong> ${s.avgScore}</div>
      <div><strong>Average accuracy:</strong> ${s.avgAccuracy}%</div>
      <div><strong>Avg confidence (0-1):</strong> ${s.avgConfidence}</div>
      <div><strong>Isolation accuracy:</strong> ${s.isolationAccuracy}%</div>
    </div>
  `;
  panel.appendChild(top);

  // Skill insight block
  const skills = document.createElement('div');
  skills.style.marginTop = '10px';
  skills.innerHTML = '<h4>Skill Insight</h4>';
  const list = document.createElement('div');
  Object.keys(s.skillProfiles).forEach(sys => {
    const v = s.skillProfiles[sys];
    const row = document.createElement('div');
    row.innerHTML = `<strong>${sys}:</strong> ${v}%`;
    list.appendChild(row);
  });
  skills.appendChild(list);
  panel.appendChild(skills);

  // Common misconceptions
  const mis = document.createElement('div'); mis.style.marginTop = '10px';
  mis.innerHTML = '<h4>Common Misconceptions</h4>';
  if (s.commonConfusions.length === 0) mis.innerHTML += '<div>No common confusions detected.</div>';
  else {
    const ul = document.createElement('ul');
    s.commonConfusions.forEach(p => { const li = document.createElement('li'); li.innerText = `${p.pair.replace('→',' → ')} — ${p.count}`; ul.appendChild(li); });
    mis.appendChild(ul);
  }
  panel.appendChild(mis);

  // Student snapshot list (minimal)
  const snap = document.createElement('div'); snap.style.marginTop = '10px';
  snap.innerHTML = '<h4>Student Snapshots</h4>';
  if (s.students.length === 0) snap.innerHTML += '<div>No students.</div>';
  else {
    const table = document.createElement('div');
    table.style.display = 'grid'; table.style.gridTemplateColumns = '2fr 1fr 1fr 1fr'; table.style.gap = '6px';
    table.innerHTML = `<div><strong>Name</strong></div><div><strong>Score</strong></div><div><strong>Weakest</strong></div><div><strong>Explanations</strong></div>`;
    s.students.forEach(st => {
      table.innerHTML += `<div>${st.name}</div><div>${st.score}</div><div>${st.weakest}</div><div>${st.explanations}</div>`;
    });
    snap.appendChild(table);
  }
  panel.appendChild(snap);

  // Learning insights aggregated across class
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const li = getLearningInsightsForClass(classData || []);
  const learn = document.createElement('div'); learn.style.marginTop = '12px';
  learn.innerHTML = '<h4>Learning Insights (class)</h4>';
  learn.innerHTML += `<div><strong>Most frequent weak system:</strong> ${li.weakestSystem ? li.weakestSystem[0] + ' (' + li.weakestSystem[1] + ')' : 'N/A'}</div>`;
  learn.innerHTML += `<div><strong>Top misconception:</strong> ${li.topMisconception ? li.topMisconception[0] + ' (' + li.topMisconception[1] + ')' : 'N/A'}</div>`;
  if (li.reasoningTrend && li.reasoningTrend.length) learn.innerHTML += `<div><strong>Recent reasoning trend (avg last 5 samples per student):</strong> [${li.reasoningTrend.map(v=>v.toFixed(1)).join(', ')}]</div>`;
  panel.appendChild(learn);

  // Adaptive recommendation (teacher-only, conservative)
  try {
    const rec = getAdaptiveRecommendation({}, classData || []);
    const dec = document.getElementById('teacherDecisions');
    if (dec) {
      dec.style.display = 'block';
      dec.innerHTML = `
        <h3>📌 Adaptive Training Recommendation</h3>
        <div><strong>Class weak system:</strong> ${rec.classWideWeakSystem}</div>
        <div><strong>Suggested focus system:</strong> ${rec.recommendedSystem}</div>
        <div><strong>Suggested difficulty band:</strong> Level ${rec.suggestedDifficulty}</div>
        <div style="margin-top:6px;font-style:italic;color:var(--muted,#999)">${rec.reason}</div>
      `;
    }
  } catch(e) { console.warn('Failed to compute adaptive recommendation', e); }

  // Scenario-level recommendations (curriculum-aware)
  try {
    renderScenarioRecommendations(classData || [], scenarios || []);
  } catch (e) { console.warn('Failed to render scenario recommendations', e); }

  // Compact calibration + Why-this details toggle
  const cal = document.createElement('div'); cal.style.marginTop = '10px';
  cal.innerHTML = `<strong>Confidence calibration (high-confidence correct):</strong> ${s.calibration.highCorrect}/${s.calibration.highTotal} (${s.calibration.calibrationPct}%)`;
  const whyBtn = document.createElement('button'); whyBtn.style.marginLeft = '10px'; whyBtn.innerText = 'Why this?';
  const detail = document.createElement('div'); detail.style.display = 'none'; detail.style.marginTop = '8px'; detail.style.padding = '8px'; detail.style.border = '1px dashed rgba(255,255,255,0.04)';
  whyBtn.addEventListener('click', () => { detail.style.display = detail.style.display === 'none' ? 'block' : 'none'; whyBtn.innerText = detail.style.display === 'none' ? 'Why this?' : 'Hide'; });
  // populate examples
  if (s.examples.confusionExamples.length) {
    const h = document.createElement('div'); h.innerHTML = '<strong>Examples (confusions):</strong>';
    const ul = document.createElement('ul'); s.examples.confusionExamples.forEach(ex => { const li = document.createElement('li'); li.innerText = `${ex.student}: ${ex.pair.replace('→',' → ')} (scenario ${ex.scenarioIndex}) — ${ex.final}`; ul.appendChild(li); });
    detail.appendChild(h); detail.appendChild(ul);
  }
  if (s.examples.calibrationExamples.length) {
    const h2 = document.createElement('div'); h2.innerHTML = '<strong>Examples (high-confidence responses):</strong>';
    const ul2 = document.createElement('ul'); s.examples.calibrationExamples.forEach(ex => { const li = document.createElement('li'); li.innerText = `${ex.student}: ${ex.final} — diagnosed ${ex.diagnosed} (scenario ${ex.scenarioIndex})`; ul2.appendChild(li); });
    detail.appendChild(h2); detail.appendChild(ul2);
  }
  cal.appendChild(whyBtn);
  cal.appendChild(detail);
  panel.appendChild(cal);

}

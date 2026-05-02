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
let demoMode = false;

const scenarios = window.scenarios || [];
const total = scenarios.length;

// Central application state (stabilization layer)
const AppState = {
  user: null,
  role: 'student',
  scenarioIndex: 0,
  score: 0,
  system: null,
  profile: {},
  ui: { view: 'homeScreen', context: null }
};

// Central SPA view router
function setView(viewId, data){
  // update central UI state
  AppState.ui.view = viewId;
  AppState.ui.context = data || null;
  const views = ['landingPage','homeScreen','loginScreen','scenarioSelectScreen','gameScreen','teacherScreen'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';
}

/* =========== SAFE DOM HELPERS =========== */
function $(id){ return document.getElementById(id); }
function setText(id, value){ const el = $(id); if (el) el.innerText = value; }
function setHTML(id, value){ const el = $(id); if (el) el.innerHTML = value; }
function show(id){ const el = $(id); if (el) el.style.display = 'block'; }
function hide(id){ const el = $(id); if (el) el.style.display = 'none'; }
function safeBind(id, handler){ const el = $(id); if (!el) return; el.addEventListener('click', handler); }

let appReady = false;

// Start a demo session without requiring login (one-scenario quick demo)
function startDemo(){
  demoMode = true;
  currentUser = 'Demo';
  userRole = 'student';
  AppState.user = currentUser;
  AppState.role = userRole;
  // start at first scenario for demo
  currentIndex = 0;
  setView('gameScreen');
  loadScenario();
}

// navigation alias that accepts context
function navigate(viewId, data){
  setView(viewId, data);
}
// Scenario selection utilities
function populateFilterSystem(){
  const sel = document.getElementById('filter-system');
  if (!sel) return;
  // clear existing options except 'all'
  const existing = Array.from(sel.querySelectorAll('option')).map(o=>o.value);
  const systems = Object.keys(systemWeights || {});
  systems.forEach(sys => {
    if (!existing.includes(sys)){
      const opt = document.createElement('option'); opt.value = sys; opt.innerText = sys.charAt(0).toUpperCase() + sys.slice(1);
      sel.appendChild(opt);
    }
  });
}

function renderScenarioList(){
  const container = document.getElementById('scenarioList');
  if (!container) return;
  populateFilterSystem();
  const fs = document.getElementById('filter-system').value || 'all';
  const fd = document.getElementById('filter-difficulty').value || 'all';
  let list = (scenarios || []).slice();
  if (fs && fs !== 'all') list = list.filter(s => s.primarySystem === fs || (s.secondarySystems && s.secondarySystems.includes(fs)));
  if (fd && fd !== 'all') list = list.filter(s => String(s.difficulty) === String(fd));

  if (list.length === 0) { container.innerHTML = '<div style="color:var(--muted)">No scenarios match the current filters.</div>'; return; }
  const html = list.map(s => {
    const id = s.id || s.index || '';
    const symptoms = (s.symptoms||'').slice(0,120);
    return `
      <div class="scenario-card">
        <div>
          <h4>Scenario ${id}</h4>
          <div class="scenario-meta">${s.primarySystem || 'N/A'} • Difficulty ${s.difficulty || 'N/A'}</div>
          <div style="margin-top:8px;color:var(--muted);font-size:90%">${symptoms}</div>
        </div>
        <div class="scenario-actions">
          <div style="flex:1"></div>
          <button onclick="showScenarioPreview('${id}')">Preview</button>
          <button onclick="startScenarioById('${id}')">Start</button>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = html;

  // wire small UI buttons
  const refresh = document.getElementById('btn-refresh-scenarios'); if (refresh) refresh.onclick = () => renderScenarioList();
  const back = document.getElementById('btn-back-to-login'); if (back) back.onclick = () => setView('loginScreen');
  const fsEl = document.getElementById('filter-system'); if (fsEl) fsEl.onchange = () => renderScenarioList();
  const fdEl = document.getElementById('filter-difficulty'); if (fdEl) fdEl.onchange = () => renderScenarioList();
}

function startScenarioById(id){
  const scen = findScenarioById(id);
  if (!scen) return alert('Scenario not found');
  const idx = scenarios.findIndex(s => s === scen || String(s.id) === String(id));
  currentIndex = idx >= 0 ? idx : 0;
  setView('gameScreen');
  loadScenario();
}

function openScenarioSelect(){
  setView('scenarioSelectScreen');
  renderScenarioList();
}

// render tools dynamically based on scenario.tests
function renderTools(scenario){
  const toolsDiv = document.getElementById('tools');
  if (!toolsDiv) return;
  // clear and build
  toolsDiv.innerHTML = '<h3>Tools</h3>';
  const tests = scenario && scenario.tests ? Object.keys(scenario.tests) : [];
  if (!tests.length) {
    toolsDiv.innerHTML += '<div style="color:var(--muted)">No tools available for this scenario.</div>';
    return;
  }
  tests.forEach(test => {
    const btn = document.createElement('button');
    btn.innerText = `Check ${test}`;
    btn.onclick = () => check(test);
    // disable if student isolated a different system (optional enforcement)
    const toolSystem = (scenario.tests && scenario.tests[test] && scenario.tests[test].system) ? scenario.tests[test].system : (test.includes('bat')||test.includes('battery')? 'electrical' : (test.includes('fuel')? 'fuel' : 'other'));
    if (AppState.system && toolSystem && AppState.system !== toolSystem) btn.disabled = true; // disable irrelevant tools when a system is isolated
    toolsDiv.appendChild(btn);
  });
}

// render diagnoses (repair actions) dynamically
function renderDiagnoses(scenario){
  const diagContainer = document.getElementById('diagnosisActions');
  if (!diagContainer) return;
  // keep Next and Download buttons present — we will prepend diagnosis buttons
  const keepNext = diagContainer.querySelector('#next');
  const keepDl = diagContainer.querySelector('#download-report');
  const faults = scenario && scenario.faults && scenario.faults.length ? scenario.faults : (scenario && scenario.fault ? [{label: scenario.fault}] : []);
  // clear
  diagContainer.innerHTML = '';
  faults.forEach(f => {
    const label = f.label || f;
    const btn = document.createElement('button');
    btn.innerText = (typeof label === 'string') ? label : JSON.stringify(label);
    btn.onclick = () => diagnose(label);
    diagContainer.appendChild(btn);
  });
  if (keepNext) diagContainer.appendChild(keepNext);
  if (keepDl) diagContainer.appendChild(keepDl);
}

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

// Delegate diagnostic functions to DiagnosticEngine (extracted module)
function formatToolOutput(systemLabel, testName, value, interpretation, conclusion){
  return (window.DiagnosticEngine && window.DiagnosticEngine.formatToolOutput)
    ? window.DiagnosticEngine.formatToolOutput(systemLabel, testName, value, interpretation, conclusion)
    : `[SYSTEM: ${systemLabel}]\nTest: ${testName}\nResult: ${value}\nInterpretation: ${interpretation}\nConclusion: ${conclusion}`;
}

// Use engine's shared fault probabilities if available
let faultProbabilities = (window.DiagnosticEngine && window.DiagnosticEngine.faultProbabilities) ? window.DiagnosticEngine.faultProbabilities : {};

// Keep a reference to interactions if engine exposes them
const faultInteractions = (window.DiagnosticEngine && window.DiagnosticEngine.faultInteractions) ? window.DiagnosticEngine.faultInteractions : {};

function applyEvidenceToModel(component, interpretation){
  if (window.DiagnosticEngine && window.DiagnosticEngine.applyEvidenceToModel) return window.DiagnosticEngine.applyEvidenceToModel(component, interpretation);
  return null;
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
  if (demoMode) return; // don't persist demo sessions

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

  // attach replays to student record when available
  localStorage.setItem('carSim_' + currentUser, JSON.stringify(student));
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const existingIndex = classData.findIndex(s => s.name === currentUser);
  // preserve and append explanations and replays history per student
  const existing = (existingIndex >= 0) ? classData[existingIndex] : null;
  student.explanations = existing && existing.explanations ? existing.explanations.slice() : [];
  student.replays = existing && existing.replays ? existing.replays.slice() : [];
  if (lastExplanation) {
    const lastSaved = student.explanations.length ? student.explanations[student.explanations.length - 1] : null;
    if (!lastSaved || lastSaved.scenarioIndex !== lastExplanation.scenarioIndex) {
      // add timestamp and store a copy
      const copy = Object.assign({}, lastExplanation, { savedAt: new Date().toISOString() });
      student.explanations.push(copy);
    }
  }
  // save replay snapshot if any actions captured
  if (currentReplay && currentReplay.length) {
    student.replays.push({ scenario: currentIndex, actions: currentReplay.slice(), savedAt: new Date().toISOString() });
    // reset current replay after saving
    currentReplay = [];
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
  // sync runtime state into AppState
  // reset replay for this scenario run
  currentReplay = [];
  AppState.scenarioIndex = currentIndex;
  AppState.score = score;
  AppState.system = selectedSystem;
  AppState.profile = studentProfile || AppState.profile || {};
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

  // render dynamic tools + diagnosis options for this scenario
  try { renderTools(s); } catch(e) { console.warn('renderTools failed', e); }
  try { renderDiagnoses(s); } catch(e) { console.warn('renderDiagnoses failed', e); }
}

function check(component){
  // capture tool use for replay
  try { currentReplay.push({ type: 'tool', value: component, time: Date.now() }); } catch(e){}
  if (window.DiagnosticEngine && window.DiagnosticEngine.useTool) {
    return window.DiagnosticEngine.useTool(AppState, component);
  }
  // fallback: engine not available
  document.getElementById('result').innerText = 'Diagnostic engine unavailable.';
}

function selectSystem(sys){
  selectedSystem = sys;
  AppState.system = sys;
  // record selection in replay (justification captured below)
  try { currentReplay.push({ type: 'system', value: sys, time: Date.now() }); } catch(e){}
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
  // capture diagnosis selection for replay
  try { currentReplay.push({ type: 'diagnosis', value: choice, time: Date.now() }); } catch(e){}
  if (window.DiagnosticEngine && window.DiagnosticEngine.diagnose) return window.DiagnosticEngine.diagnose(AppState, choice);
  pendingDiagnosisChoice = choice;
  const panel = document.getElementById('confidencePanel'); if (panel) panel.style.display = 'block';
}

// Apply diagnosis after user selects confidence via UI
async function applyDiagnosisWithConfidence(conf){
  // capture confidence selection
  try { currentReplay.push({ type: 'confidence', value: conf, time: Date.now() }); } catch(e){}
  if (window.DiagnosticEngine && window.DiagnosticEngine.applyDiagnosisWithConfidence) return window.DiagnosticEngine.applyDiagnosisWithConfidence(AppState, conf);
  // fallback
  alert('Diagnostic engine unavailable');
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

  // sync into AppState
  AppState.user = currentUser;
  AppState.role = userRole;

  // route via central router
  if(userRole === 'teacher'){
    setView('teacherScreen');
    await loadTeacherData();
    return;
  }

  // STUDENT flow: if teacher has assigned a scenario, start it; otherwise show selection
  await loadUserData();
  AppState.profile = studentProfile || {};
  const assignment = JSON.parse(localStorage.getItem('carSim_assignment') || 'null');
  if (assignment && assignment.activeScenario) {
    // try to locate scenario index
    const target = findScenarioById(assignment.activeScenario);
    let idx = 0;
    if (target) idx = scenarios.findIndex(s => s === target);
    if (idx < 0) idx = 0;
    currentIndex = idx;
    AppState.scenarioIndex = currentIndex;
    setView('gameScreen');
    loadScenario();
    return;
  }

  // otherwise show scenario selector
  setView('scenarioSelectScreen');
  renderScenarioList();
}

function logout(){
  currentUser = null;
  userRole = 'student';
  setView('loginScreen');
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
    <div class="teacher-student-entry" data-student-name="${s.name}" style="border:1px solid rgba(255,255,255,0.06); padding:10px; margin:8px; background:rgba(255,255,255,0.01)">
      <h3>${s.name}</h3>
      <p>Score: ${s.score}</p>
      <p>Accuracy: ${s.correct} / ${s.correct + s.wrong}</p>
      <p>Level: ${s.currentLevel + 1}/${total}</p>
      <p>Status: ${s.completed ? 'Completed' : 'In Progress'}</p>
      <p>Last: ${s.lastUpdated || '—'}</p>
      <p>Explanations: ${s.explanations ? s.explanations.length : 0}</p>
      <div style="margin-top:8px"><button class="btn-view-replay secondary-cta" data-name="${s.name}">View Replay</button></div>
    </div>
  `).join('');

  // bind replay buttons
  setTimeout(() => {
    const buttons = document.querySelectorAll('.btn-view-replay');
    buttons.forEach(b => {
      const name = b.getAttribute('data-name');
      if (!name) return;
      b.addEventListener('click', () => openStudentDetail(name));
    });
  }, 10);
}

// Open student detail and show latest replay (if present)
function openStudentDetail(name){
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const student = classData.find(s => s.name === name);
  if (!student){ alert('Student data not found'); return; }
  // render some quick stats into teacherDecisions area
  const dec = document.getElementById('teacherDecisions');
  if (dec) {
    dec.style.display = 'block';
    dec.innerHTML = `
      <h3>${student.name}</h3>
      <p>Score: ${student.score}</p>
      <p>Accuracy: ${student.correct} / ${student.correct + student.wrong}</p>
      <p>Last: ${student.lastUpdated || '—'}</p>
    `;
  }
  showReplay(student);
}

function showReplay(student){
  const viewer = document.getElementById('replayViewer');
  const timeline = document.getElementById('replayTimeline');
  if (!viewer || !timeline) return;
  const replays = student.replays || [];
  if (!replays.length){ timeline.innerHTML = '<p>No replay data available for this student.</p>'; viewer.style.display = 'block'; return; }
  // show most recent replay by default
  const last = replays[replays.length - 1];
  timeline.innerHTML = '';
  last.actions.forEach(a => {
    const el = document.createElement('div'); el.className = 'replay-item';
    const t = document.createElement('span'); t.className = 'replay-time'; t.innerText = new Date(a.time).toLocaleTimeString();
    const content = document.createElement('span'); content.innerHTML = formatReplayAction(a);
    el.appendChild(t); el.appendChild(content);
    timeline.appendChild(el);
  });
  viewer.style.display = 'block';
}

function formatReplayAction(a){
  if (!a || !a.type) return '';
  switch(a.type){
    case 'system': return `Selected system: <strong>${a.value}</strong>` + (a.justification ? ` — ${a.justification}` : '');
    case 'tool': return `Used tool: <strong>${a.value}</strong>`;
    case 'diagnosis': return `Diagnosis chosen: <strong>${a.value}</strong>`;
    case 'confidence': return `Confidence: <strong>${a.value}</strong>`;
    default: return `${a.type}: ${JSON.stringify(a)}`;
  }
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
  if (appReady) return;
  appReady = true;

  /* ===== LANDING BUTTONS ===== */
  safeBind('btn-start-training', () => setView('loginScreen'));
  safeBind('btn-start-final', () => setView('loginScreen'));

  safeBind('btn-student', () => { userRole = 'student'; setView('loginScreen'); });
  safeBind('btn-teacher', () => { userRole = 'teacher'; setView('loginScreen'); });

  safeBind('btn-demo', () => startDemo());

  /* ===== LOGIN ===== */
  safeBind('btn-enter', () => login());

  /* ===== GAME TOOLS ===== */
  safeBind('btn-battery', () => check('battery'));
  safeBind('btn-starter', () => check('starter'));
  safeBind('btn-fuel', () => check('fuel'));
  safeBind('btn-obd', () => check('obd'));

  /* ===== DIAGNOSIS ===== */
  safeBind('diag-battery', () => diagnose('battery'));
  safeBind('diag-starter', () => diagnose('starter'));
  safeBind('diag-fuel', () => diagnose('fuel'));
  safeBind('diag-spark', () => diagnose('spark'));

  safeBind('next', nextScenario);
  safeBind('download-report', downloadReport);

  /* ===== TEACHER ===== */
  safeBind('btn-refresh', loadTeacherData);
  safeBind('btn-export', exportAll);
  safeBind('btn-export-explanations', exportExplanationsCSV);
  safeBind('btn-insights', renderTeacherInsights);

  /* ===== CONFIDENCE ===== */
  safeBind('conf-high', () => applyDiagnosisWithConfidence('high'));
  safeBind('conf-medium', () => applyDiagnosisWithConfidence('medium'));
  safeBind('conf-low', () => applyDiagnosisWithConfidence('low'));

  /* ===== SYSTEM SELECT ===== */
  safeBind('sys-electrical', () => selectSystem('electrical'));
  safeBind('sys-fuel', () => selectSystem('fuel'));
  safeBind('sys-ignition', () => selectSystem('ignition'));
  safeBind('sys-air', () => selectSystem('air'));
  safeBind('sys-ecu', () => selectSystem('ecu'));
  safeBind('sys-other', () => selectSystem('other'));

  /* ===== EXPORT / TEACHER HELPERS ===== */
  safeBind('btn-export-explanations', exportExplanationsCSV);

  /* ===== OVERLAY START/SKIP (optional) ===== */
  const startOverlayBtn = $( 'btn-start' ); if (startOverlayBtn) startOverlayBtn.addEventListener('click', () => { const o = $('startOverlay'); if (o) o.style.display = 'none'; setView('loginScreen'); const u = $('username'); if (u) u.focus(); });
  const skip = $('btn-skip'); if (skip) skip.addEventListener('click', () => { const o = $('startOverlay'); if (o) o.style.display = 'none'; setView('loginScreen'); });

  /* ===== INITIAL VIEW ===== */
  try { setView('landingPage'); } catch(e) { setView('homeScreen'); }
});

/* Demo modal controls */
function openDemo(){ const m = $('demoModal'); if (m) m.style.display = 'flex'; }
function closeDemo(){ const m = $('demoModal'); if (m) m.style.display = 'none'; }

// Bind modal buttons (also allow landing hero button to open modal)
safeBind('btn-demo', openDemo);
safeBind('btn-start-demo', () => { closeDemo(); startDemo(); });
safeBind('btn-close-demo', closeDemo);

// Hero teacher CTA (open login as teacher)
safeBind('btn-teacher-hero', () => { userRole = 'teacher'; setView('loginScreen'); });

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

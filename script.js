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
let activeSystemFilter = null;
// Class context
let currentClassId = localStorage.getItem('carSim_currentClassId') || null;
let currentClassCode = localStorage.getItem('carSim_currentClassCode') || null;

const scenarios = window.scenarios || [];
const total = scenarios.length;

// API base: set `window.API_BASE_URL` in hosting environment to point to deployed API.
const API_BASE = (typeof window.API_BASE_URL !== 'undefined' && window.API_BASE_URL) ? String(window.API_BASE_URL).replace(/\/$/, '') : '';

// Lightweight wrappers that delegate to central auth/api modules when available.
// These ensure `auth.js` / `apiClient.js` can provide implementations.
async function supabaseSignIn(email, password){
  if (window.supabaseSignIn && window.supabaseSignIn !== supabaseSignIn) return window.supabaseSignIn(email, password);
  // fallback inline implementation
  const url = (window.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = window.SUPABASE_ANON_KEY || '';
  if (!url || !anon) return { error: 'Supabase not configured' };
  try {
    const res = await fetch(url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type':'application/json','apikey': anon,'Accept':'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    if (!res.ok) return body;
    if (body.access_token){
      localStorage.setItem('supabase_access_token', body.access_token);
      localStorage.setItem('supabase_refresh_token', body.refresh_token || '');
      localStorage.setItem('supabase_user_email', email);
    }
    return body;
  } catch (e){ return { error: e.message || String(e) }; }
}

function supabaseSignOut(){
  if (window.supabaseSignOut && window.supabaseSignOut !== supabaseSignOut) return window.supabaseSignOut();
  localStorage.removeItem('supabase_access_token');
  localStorage.removeItem('supabase_refresh_token');
  localStorage.removeItem('supabase_user_email');
}

function showToast(msg, timeout=3000){
  if (window.showToast && window.showToast !== showToast) return window.showToast(msg, timeout);
  let t = document.getElementById('carSim_toast');
  if (!t){ t = document.createElement('div'); t.id = 'carSim_toast'; t.style.position = 'fixed'; t.style.right = '12px'; t.style.top = '12px'; t.style.zIndex = 10000; document.body.appendChild(t); }
  const el = document.createElement('div'); el.style.background = 'rgba(0,0,0,0.8)'; el.style.color='white'; el.style.padding='8px 12px'; el.style.marginTop='8px'; el.style.borderRadius='6px'; el.innerText = msg;
  t.appendChild(el); setTimeout(()=>{ el.remove(); }, timeout);
}

function copyToClipboard(text){
  if (!text) return false;
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(()=>showToast('Copied to clipboard')); return true; }
  try { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('Copied to clipboard'); return true; } catch(e){ return false; }
}

function clearLocalFallbackOnAuth(){
  if (window.clearLocalFallbackOnAuth && window.clearLocalFallbackOnAuth !== clearLocalFallbackOnAuth) return window.clearLocalFallbackOnAuth();
  const token = getAccessToken(); if (!token) return; if (currentClassId && String(currentClassId).startsWith('local-')){ currentClassId = null; currentClassCode = null; localStorage.removeItem('carSim_currentClassId'); localStorage.removeItem('carSim_currentClassCode'); }
}

function getAccessToken(){ if (window.getAccessToken && window.getAccessToken !== getAccessToken) return window.getAccessToken(); return localStorage.getItem('supabase_access_token') || null; }

// Modal-based teacher sign-in (replaces prompt-based flow)
function ensureTeacherLoginModal(){
  let modal = document.getElementById('teacherLoginModal');
  if (modal) return modal;

  // inject styles for modal inputs/buttons
  injectTeacherLoginModalStyles();

  modal = document.createElement('div');
  modal.id = 'teacherLoginModal';
  modal.style.cssText = `
    position:fixed; inset:0; display:none; align-items:center; justify-content:center;
    background:rgba(0,0,0,.65); z-index:10001;
  `;

  modal.innerHTML = `
    <div style="width:min(420px,92vw);background:var(--bg,#111);color:var(--fg,#fff);
      border-radius:12px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35)">
      <h2>Teacher Sign In</h2>
      <p style="color:var(--muted,#aaa)">Sign in to access the teacher dashboard.</p>

      <form id="teacherLoginForm">
        <label for="teacherLoginEmail">Email</label>
        <input id="teacherLoginEmail" name="email" type="email" autocomplete="username"
          style="width:100%;margin:6px 0 12px;padding:10px">

        <label for="teacherLoginPassword">Password</label>
        <input id="teacherLoginPassword" name="password" type="password" autocomplete="current-password"
          style="width:100%;margin:6px 0 12px;padding:10px">

        <div id="teacherLoginError" style="color:#ff8a8a;margin-bottom:10px"></div>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="teacherLoginCancel" type="button">Cancel</button>
          <button id="teacherLoginSubmit" type="submit">Sign In</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

function injectTeacherLoginModalStyles(){
  if (document.getElementById('teacherLoginModalStyles')) return;

  const style = document.createElement('style');
  style.id = 'teacherLoginModalStyles';
  style.textContent = `
    #teacherLoginModal input {
      box-sizing: border-box;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      background: rgba(255,255,255,.06);
      color: inherit;
      outline: none;
    }

    #teacherLoginModal input:focus {
      border-color: rgba(6,182,212,.9);
      box-shadow: 0 0 0 3px rgba(6,182,212,.18);
    }

    #teacherLoginModal button {
      border-radius: 8px;
      padding: 9px 14px;
      cursor: pointer;
    }

    #teacherLoginSubmit {
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
}

function teacherLoginPrompt(){
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    alert('Supabase is not configured for this frontend.');
    return Promise.resolve(false);
  }

  const modal = ensureTeacherLoginModal();
  const emailEl = document.getElementById('teacherLoginEmail');
  const passEl = document.getElementById('teacherLoginPassword');
  const errEl = document.getElementById('teacherLoginError');
  const submit = document.getElementById('teacherLoginSubmit');
  const cancel = document.getElementById('teacherLoginCancel');

  if (errEl) errEl.innerText = '';
  if (passEl) passEl.value = '';
  modal.style.display = 'flex';
  setTimeout(() => { if (emailEl) emailEl.focus(); }, 0);

  return new Promise(resolve => {
    const cleanup = result => {
      if (submit) submit.onclick = null;
      if (cancel) cancel.onclick = null;
      if (modal) modal.onclick = null;
      if (emailEl) emailEl.removeEventListener('keydown', onKeyDown);
      if (passEl) passEl.removeEventListener('keydown', onKeyDown);
      modal.style.display = 'none';
      resolve(result);
    };

    if (cancel) cancel.onclick = () => cleanup(false);

    modal.onclick = e => { if (e.target === modal) cleanup(false); };

    if (submit) submit.onclick = async () => {
      const email = (emailEl && emailEl.value) ? emailEl.value.trim() : '';
      const password = passEl ? passEl.value : '';

      if (!email || !password) {
        if (errEl) errEl.innerText = 'Enter both email and password.';
        return;
      }

      submit.disabled = true;
      submit.innerText = 'Signing in...';

      const res = await supabaseSignIn(email, password);

      submit.disabled = false;
      submit.innerText = 'Sign In';

      if (res && res.access_token) {
        showToast('Signed in successfully');
        try {
          clearLocalFallbackOnAuth();
          if (document.getElementById('teacherClassesSelect')) await loadTeacherClasses();
        } catch(e){}
        cleanup(true);
        return;
      }

      if (errEl) errEl.innerText = 'Sign-in failed: ' + (res?.error_description || res?.error || 'Invalid login');
    };

    // keyboard handlers: Enter submits, Escape cancels
    function onKeyDown(e){
      if (e.key === 'Enter'){
        e.preventDefault();
        if (submit) submit.click();
      }
      if (e.key === 'Escape'){
        e.preventDefault();
        cleanup(false);
      }
    }

    if (emailEl) emailEl.addEventListener('keydown', onKeyDown);
    if (passEl) passEl.addEventListener('keydown', onKeyDown);
  });
}

// Wire teacher-facing buttons to prompt for login then open teacher screen.
document.addEventListener('DOMContentLoaded', () => {
  const teacherBtns = ['btn-teacher', 'btn-teacher-hero', 'btn-teacher-hero'];
  teacherBtns.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      // delegate to setView which will enforce auth before rendering teacher screen
      setView('teacherScreen');
    });
  });

  // wire any static "back to landing" buttons added in HTML
  document.querySelectorAll('.btn-back-to-landing').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); setView('landingPage'); });
  });

  const logoutEl = document.getElementById('btn-back'); // reuse Back button as a quick sign-out for teachers
  if (logoutEl) logoutEl.addEventListener('click', () => { supabaseSignOut(); setView('loginScreen'); });
});

// Listen for global auth expiry events (triggered from fetch monkey-patch)
window.addEventListener('supabase:authExpired', (ev) => {
  const status = ev?.detail?.status;
  try { showTeacherError('Session expired. Please sign in again.'); } catch (e){}
  setTimeout(() => { setView('loginScreen'); }, 700);
});

/* ========== Teacher auth + UI helpers ========== */
function showTeacherError(msg){
  let container = document.getElementById('teacherErrorMsg');
  if (!container){
    const teacherScreen = document.getElementById('teacherScreen');
    if (!teacherScreen) return;
    container = document.createElement('div');
    container.id = 'teacherErrorMsg';
    container.style.margin = '12px 0';
    container.style.padding = '10px';
    container.style.background = 'var(--bg-muted, #2b2b2b)';
    container.style.color = 'var(--fg, #fff)';
    container.style.borderRadius = '6px';
    teacherScreen.insertBefore(container, teacherScreen.firstChild);
  }
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="flex:1">${escapeHtml(msg)}</div><div><button id="teacher-error-retry">Retry</button> <button id="teacher-error-signin">Sign in</button></div></div>`;
  // wire retry and sign-in buttons
  const retry = document.getElementById('teacher-error-retry'); if (retry) retry.onclick = () => { clearTeacherError(); loadTeacherData(); };
  const signin = document.getElementById('teacher-error-signin'); if (signin) signin.onclick = async () => { clearTeacherError(); const ok = await teacherLoginPrompt(); if (ok) loadTeacherData(); };
}

function clearTeacherError(){ const el = document.getElementById('teacherErrorMsg'); if (el) el.remove(); }

function escapeHtml(str){ if (!str) return ''; return String(str).replace(/[&<>\\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

async function ensureTeacherAuthAndRender(){
  // Called when navigating to teacherScreen. Ensures token exists and is valid.
  const token = getAccessToken();
  if (!token){
    // no token: prompt sign-in inline
    showTeacherError('You must sign in as a teacher to view this dashboard.');
    return;
  }
  // token present: verify by calling protected endpoint
  try {
    // if authenticated, clear any local fallback class ids
    try { clearLocalFallbackOnAuth(); } catch(e){}
    const path = '/api/teacher/data' + (currentClassId ? ('?classId=' + encodeURIComponent(currentClassId)) : '');
    try {
      const data = await apiGet(path);
      if (!data){
        showTeacherError('Unable to fetch teacher data. Retry or sign in.');
        return;
      }
      clearTeacherError();
      try { if (document.getElementById('teacherClassesSelect')) await loadTeacherClasses(); } catch(e){}
      renderTeacherData(data);
      return;
    } catch (e){
      if (e && (e.status === 401 || e.status === 403)){
        try { supabaseSignOut(); } catch(_){}
        showTeacherError('Authentication failed. Please sign in again.');
        return;
      }
      showTeacherError('Unable to fetch teacher data (' + (e && e.status ? e.status : 'network') + '). Retry or sign in.');
      return;
    }
    clearTeacherError();
    try { if (document.getElementById('teacherClassesSelect')) await loadTeacherClasses(); } catch(e){}
    renderTeacherData(data);
  } catch (e){
    showTeacherError('Network error while loading teacher data. Check connection and retry.');
  }
}

// `loadTeacherData()` implemented later — avoid duplicate definition.

function renderTeacherData(data){
  // Minimal rendering: show summary panel and student list; more enhancements later
  try {
    const panel = document.getElementById('teacherSummaryPanel'); if (panel) panel.style.display = 'block';
    const studentList = document.getElementById('studentList'); if (studentList){
      studentList.innerHTML = '';
      if (Array.isArray(data.students) && data.students.length){
        const list = document.createElement('div'); list.className = 'card';
        data.students.forEach(s => {
          const row = document.createElement('div'); row.style.padding = '6px 0';
          const nameEl = document.createElement('strong'); nameEl.innerText = s.name || s.email || 'Student';
          const sep = document.createElement('span'); sep.style.marginLeft = '8px'; sep.innerText = ' — ' + (s.class || '');
          const btn = document.createElement('button'); btn.className = 'secondary-cta btn-view-student'; btn.innerText = 'View';
          btn.addEventListener('click', () => viewStudent(s.id || ''));
          row.appendChild(nameEl);
          row.appendChild(sep);
          row.appendChild(btn);
          list.appendChild(row);
        });
        studentList.appendChild(list);
      } else {
        studentList.innerHTML = '<div style="color:var(--muted)">No students yet.</div>';
      }
    }
  } catch (e){ console.warn('renderTeacherData failed', e); }
}

function viewStudent(id){ alert('Open student view: ' + id); }

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

// Ensure a global studentProfile object exists early so loadScenario() can rely on it
let studentProfile = window.studentProfile || {
  weakSystems: {},
  misconceptionMap: {},
  reasoningScoreHistory: []
};
window.studentProfile = studentProfile;

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
  // If navigating to teacher screen, enforce auth and load data
  if (viewId === 'teacherScreen'){
    // small async fire-and-forget
    setTimeout(() => { loadTeacherData(); }, 0);
  }
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

/* =========== API HELPERS (minimal, with local fallback) =========== */
async function apiGet(path){
  if (window.apiGet && window.apiGet !== apiGet) return window.apiGet(path);
  try {
    const url = API_BASE ? (API_BASE + path) : path;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e){ return null; }
}

async function apiPost(path, body){
  if (window.apiPost && window.apiPost !== apiPost) return window.apiPost(path, body);
  try {
    const url = API_BASE ? (API_BASE + path) : path;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e){ return null; }
}

async function createClass(name){ return apiPost('/api/classes', { name }); }
async function getClasses(){ return apiGet('/api/classes'); }
async function findClassByCode(code){ return apiGet('/api/classes/by-code/' + encodeURIComponent(code)); }
async function enrollInClass(classId, code){ return apiPost(`/api/classes/${classId}/enroll`, { code }); }


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
          <button class="btn-preview" data-id="${id}">Preview</button>
          <button class="btn-start" data-id="${id}">Start</button>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = html;

  // attach handlers for preview/start buttons
  setTimeout(() => {
    container.querySelectorAll('.btn-preview').forEach(b => { const id = b.getAttribute('data-id'); if (!id) return; b.addEventListener('click', () => showScenarioPreview(id)); });
    container.querySelectorAll('.btn-start').forEach(b => { const id = b.getAttribute('data-id'); if (!id) return; b.addEventListener('click', () => startScenarioById(id)); });
  }, 0);

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

// Firestore integration removed — frontend uses Supabase + API.
let useFirestore = false;
let db = null;

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
// Lightweight fallback: compute simple learning insights for a class
function getLearningInsightsForClass(classData){
  try {
    // safe defaults
    const systemWeakness = {};
    const misconceptions = {};
    const reasoningPerStudent = [];

    if (!Array.isArray(classData) || classData.length === 0) {
      return { weakestSystem: null, topMisconception: null, reasoningTrend: [], systemWeakness: {}, misconceptions: {} };
    }

    // Walk students and collect signals
    classData.forEach(student => {
      // 1) aggregate weak system counts (support studentProfile.weakSystems or legacy weakSystems)
      const ws = (student && student.studentProfile && student.studentProfile.weakSystems) ? student.studentProfile.weakSystems : (student && student.weakSystems) ? student.weakSystems : {};
      Object.entries(ws || {}).forEach(([sys, cnt]) => { systemWeakness[sys] = (systemWeakness[sys] || 0) + (Number(cnt) || 0); });

      // 2) aggregate misconception pairs from explanations if available
      const exs = Array.isArray(student.explanations) ? student.explanations : [];
      exs.forEach(ex => {
        // prefer an explicit 'pair' like "battery->starter" or 'confusion'
        let key = null;
        if (ex && ex.pair) key = String(ex.pair);
        else if (ex && ex.confusion) key = String(ex.confusion);
        else if (ex && ex.selectedSystem && ex.diagnosed) key = `${ex.selectedSystem}->${ex.diagnosed}`;
        if (key) misconceptions[key] = (misconceptions[key] || 0) + 1;
      });

      // 3) collect recent reasoning scores (support multiple field names)
      let scores = [];
      if (Array.isArray(student.reasoningSamples) && student.reasoningSamples.length) scores = student.reasoningSamples.map(Number).filter(n=>!isNaN(n));
      else if (Array.isArray(student.reasoningHistory) && student.reasoningHistory.length) scores = student.reasoningHistory.map(Number).filter(n=>!isNaN(n));
      else if (exs.length){
        // try to extract numeric confidence/reasoningScore per explanation
        const confidences = exs.map(e => (e && (typeof e.confidence === 'number' ? e.confidence : (typeof e.reasoningScore === 'number' ? e.reasoningScore : null)))).filter(n=>typeof n === 'number');
        scores = confidences;
      }
      if (scores.length) reasoningPerStudent.push(scores.slice(-5)); // keep last up to 5 samples per student
    });

    // Determine weakest system (highest aggregated count)
    const weakestEntry = Object.entries(systemWeakness).sort((a,b)=> b[1]-a[1])[0] || null;

    // Determine top misconception
    const topMisEntry = Object.entries(misconceptions).sort((a,b)=> b[1]-a[1])[0] || null;

    // Build reasoningTrend: align samples from most-recent backwards up to 5 points
    const maxLen = reasoningPerStudent.reduce((m, arr) => Math.max(m, arr.length), 0);
    const points = Math.min(5, maxLen);
    const trend = [];
    for (let i = points; i >= 1; i--){
      // index-from-end = i (1 => oldest of last window, points => most recent)
      const idxFromEnd = i;
      const vals = reasoningPerStudent.map(arr => arr[arr.length - idxFromEnd]).filter(v=>typeof v === 'number');
      if (vals.length){
        const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
        trend.push(Math.round(avg * 10)/10);
      }
    }

    return {
      weakestSystem: weakestEntry ? weakestEntry[0] : null,
      topMisconception: topMisEntry ? topMisEntry[0] : null,
      reasoningTrend: trend,
      systemWeakness,
      misconceptions
    };
  } catch (e){
    return { weakestSystem: null, topMisconception: null, reasoningTrend: [], systemWeakness: {}, misconceptions: {} };
  }
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
      html += `<div style="display:flex;gap:6px"><button class="btn-preview" data-id="${s.id}">Preview</button><button class="btn-assign-scenario" data-id="${s.id}">Assign to Class</button></div></div>`;
      html += `</div>`;
    });
  }
  container.innerHTML = html;
  // attach handlers for preview and assign buttons
  setTimeout(() => {
    container.querySelectorAll('.btn-preview').forEach(b => { const id = b.getAttribute('data-id'); if (!id) return; b.addEventListener('click', () => showScenarioPreview(id)); });
    container.querySelectorAll('.btn-assign-scenario').forEach(b => { const id = b.getAttribute('data-id'); if (!id) return; b.addEventListener('click', () => assignScenarioToClass(id)); });
  }, 0);
}

// --- Confidence calibration chart (teacher dashboard) ---
function computeConfidenceData(classData){
  const buckets = {
    high: { correct:0, total:0 },
    medium: { correct:0, total:0 },
    low: { correct:0, total:0 }
  };

  (classData || []).forEach(s => {
    (s.replays || []).forEach(r => {
      const conf = (r.actions || []).find(a => a.type === 'confidence');
      // fallback: if no confidence recorded, assume 'medium'
      const levelRaw = conf && typeof conf.value !== 'undefined' ? conf.value : 'medium';
      const level = String(levelRaw).toLowerCase();
      const key = (level === 'high' || level === 'h') ? 'high' : (level === 'medium' || level === 'm') ? 'medium' : 'low';
      buckets[key].total++;
      // determine correctness by comparing diagnosis to scenario truth
      if (isCorrectDiagnosis(r)) {
        buckets[key].correct++;
      }
    });
  });
  return buckets;
}

function isCorrectDiagnosis(replay){
  if (!replay || !Array.isArray(replay.actions)) return false;
  const diag = replay.actions.find(a => a.type === 'diagnosis');
  if (!diag) return false;
  const scenRef = replay.scenario;
  let scenario = null;
  if (typeof scenRef === 'number') scenario = scenarios[scenRef];
  else scenario = (scenarios || []).find(s => String(s.id) === String(scenRef));
  if (!scenario) return false;
  const expected = scenario.fault || scenario.correct || scenario.answer || '';
  return String(diag.value).toLowerCase() === String(expected).toLowerCase();
}

function renderConfidenceChart(classData){
  const canvas = document.getElementById('confidenceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const data = computeConfidenceData(classData || []);
  const labels = ['high','medium','low'];
  const values = labels.map(l => {
    const b = data[l];
    return b.total ? (b.correct / b.total) * 100 : 0;
  });

  // simple bar chart
  const barWidth = 80;
  const gap = 40;
  const baseY = 180;
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = '#fff';
  // draw baseline
  ctx.beginPath(); ctx.moveTo(20, baseY); ctx.lineTo(canvas.width - 20, baseY); ctx.strokeStyle = '#555'; ctx.stroke();
  // y axis labels
  [0,25,50,75,100].forEach(p => {
    const y = baseY - (p/100)*150;
    ctx.fillStyle = '#888';
    ctx.fillText(p + '%', 6, y + 4);
    // small grid line
    ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(canvas.width - 28, y); ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.stroke();
  });
  // title
  ctx.fillStyle = '#fff'; ctx.fillText('Accuracy by Confidence', 120, 16);

  labels.forEach((lab, i) => {
    const x = i * (barWidth + gap) + 60;
    const h = (values[i] / 100) * 150;
    // bar
    ctx.fillStyle = 'rgba(6,182,212,0.95)';
    ctx.fillRect(x, baseY - h, barWidth, h);
    // label
    ctx.fillStyle = '#fff';
    ctx.fillText(lab.charAt(0).toUpperCase() + lab.slice(1), x, baseY + 18);
    // value
    ctx.fillText(Math.round(values[i]) + '%', x, baseY - h - 8);
  });

  // insight text under chart
  try{
    const insightEl = document.getElementById('confidenceInsight');
    if (insightEl) insightEl.innerText = generateConfidenceInsight(data);
  }catch(e){}
}

function generateConfidenceInsight(data){
  const high = data.high || {correct:0,total:0};
  const pct = high.total ? (high.correct / high.total) : 0;
  if (pct < 0.5) return '⚠️ Students are overconfident — high confidence answers are often incorrect.';
  if (pct > 0.8) return '✅ High confidence aligns well with correct answers.';
  return 'ℹ️ Confidence levels are moderately aligned with performance.';
}

// --- System performance heatmap ---
function computeSystemPerformance(classData){
  const systems = {};
  (classData || []).forEach(student => {
    (student.replays || []).forEach(r => {
      const systemAction = (r.actions || []).find(a => a.type === 'system');
      if (!systemAction) return;
      const system = systemAction.value || 'unknown';
      systems[system] = systems[system] || { correct: 0, total: 0 };
      systems[system].total++;
      if (isCorrectDiagnosis(r)) systems[system].correct++;
    });
  });
  return systems;
}

function renderSystemHeatmap(classData){
  const el = document.getElementById('systemHeatmap');
  if (!el) return;
  const data = computeSystemPerformance(classData || []);
  const entries = Object.entries(data).sort((a,b) => {
    const pa = a[1].total ? a[1].correct / a[1].total : 0;
    const pb = b[1].total ? b[1].correct / b[1].total : 0;
    return pb - pa;
  });
  if (!entries.length) { el.innerHTML = '<div style="color:var(--muted)">No system data yet.</div>'; return; }
  el.innerHTML = entries.map(([system, stats]) => {
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    let level = 'medium';
    if (pct < 50) level = 'low';
    else if (pct > 75) level = 'high';
    return `\n      <div class="heatmap-cell ${level}">\n        <strong>${system}</strong><br>\n        ${pct}%\n      </div>\n    `;
  }).join('');
  // bind clicks and tooltips
  el.querySelectorAll('.heatmap-cell').forEach(cell => {
    const sysText = cell.querySelector('strong') ? cell.querySelector('strong').innerText : cell.textContent || '';
    const sys = sysText.trim();
    const stats = data[sys] || {correct:0,total:0};
    cell.setAttribute('data-system', sys);
    cell.title = `${stats.correct}/${stats.total} correct`;
    cell.addEventListener('click', () => {
      applySystemFilter(sys);
      el.querySelectorAll('.heatmap-cell').forEach(c => c.classList.toggle('selected', c.getAttribute('data-system') === sys));
    });
  });
  if (activeSystemFilter) {
    const sel = el.querySelector(`.heatmap-cell[data-system="${activeSystemFilter}"]`);
    if (sel) sel.classList.add('selected');
  }
}

function applySystemFilter(system){
  activeSystemFilter = system;
  renderFilteredStudents();
}

function clearSystemFilter(){
  activeSystemFilter = null;
  renderFilteredStudents();
  const hm = document.getElementById('systemHeatmap'); if (hm) hm.querySelectorAll('.heatmap-cell').forEach(c => c.classList.remove('selected'));
}

function renderFilteredStudents(){
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const list = document.getElementById('studentList');
  if (!list) return;
  let filtered = classData;
  if (activeSystemFilter){
    filtered = classData.filter(s => (s.replays || []).some(r => {
      const sys = (r.actions || []).find(a => a.type === 'system');
      return sys && String(sys.value) === String(activeSystemFilter);
    }));
  }

  // build header with optional filter controls
  list.innerHTML = '';
  const header = document.createElement('div'); header.style.marginBottom = '8px'; header.style.display = 'flex'; header.style.gap = '8px'; header.style.alignItems = 'center';
  if (activeSystemFilter){
    const pill = document.createElement('span'); pill.className = 'filter-pill'; pill.innerText = `Filtered: ${activeSystemFilter}`;
    const btnClear = document.createElement('button'); btnClear.className = 'ghost btn-clear-filter'; btnClear.innerText = 'Clear';
    const btnAssignWeak = document.createElement('button'); btnAssignWeak.className = 'btn-assign-weak'; btnAssignWeak.dataset.system = activeSystemFilter; btnAssignWeak.innerText = 'Assign to Weak Students';
    const btnAssignSel = document.createElement('button'); btnAssignSel.className = 'btn-assign-selected'; btnAssignSel.dataset.system = activeSystemFilter; btnAssignSel.innerText = 'Assign to Selected';
    header.appendChild(pill); header.appendChild(btnClear); header.appendChild(btnAssignWeak); header.appendChild(btnAssignSel);
  }
  list.appendChild(header);

  // build student entries
  const container = document.createElement('div');
  if (!filtered.length){
    container.innerHTML = '<div style="color:var(--muted)">No students match the filter.</div>';
    list.appendChild(container);
  } else {
    filtered.forEach(s => {
      const row = document.createElement('div'); row.className = 'student-row'; row.dataset.studentName = s.name; row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px'; row.style.padding = '8px 0';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'student-select'; chk.value = s.name;
      const info = document.createElement('div'); info.style.flex = '1'; info.innerHTML = `<strong>${escapeHtml(s.name)}</strong><br><span class="muted">${escapeHtml(getStudentAssignmentProgress(s))}</span>`;
      const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px';
      const btnView = document.createElement('button'); btnView.className = 'secondary-cta btn-open-student'; btnView.innerText = 'View'; btnView.addEventListener('click', () => openStudentDetail(s.name));
      const btnReplay = document.createElement('button'); btnReplay.className = 'btn-view-replay secondary-cta'; btnReplay.dataset.name = s.name; btnReplay.innerText = 'Replay'; btnReplay.addEventListener('click', () => openStudentDetail(s.name));
      actions.appendChild(btnView); actions.appendChild(btnReplay);
      row.appendChild(chk); row.appendChild(info); row.appendChild(actions);
      container.appendChild(row);
    });
    list.appendChild(container);
  }

  // attach header listeners
  const btnClearEl = list.querySelector('.btn-clear-filter'); if (btnClearEl) btnClearEl.addEventListener('click', clearSystemFilter);
  const btnAssignWeakEl = list.querySelector('.btn-assign-weak'); if (btnAssignWeakEl) btnAssignWeakEl.addEventListener('click', () => assignTraining(btnAssignWeakEl.dataset.system));
  const btnAssignSelEl = list.querySelector('.btn-assign-selected'); if (btnAssignSelEl) btnAssignSelEl.addEventListener('click', () => assignTrainingToSelected(btnAssignSelEl.dataset.system));
}

function getSelectedStudents(){
  return Array.from(document.querySelectorAll('.student-select:checked')).map(el => el.value);
}

function assignTrainingToSelected(system){
  if (!system) return alert('No system selected for assignment');
  const selectedNames = getSelectedStudents();
  if (!selectedNames.length) return alert('Select at least one student');
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const rec = getRecommendedScenarios(system);
  let assignedCount = 0;
  const updated = classData.map(student => {
    if (!selectedNames.includes(student.name)) return student;
    student.assigned = student.assigned || [];
    student.assigned.push({ system, scenarios: rec.map(s => s.id), completed: [], date: Date.now() });
    assignedCount++;
    return student;
  });
  localStorage.setItem('carSim_class', JSON.stringify(updated));
  alert(`Assigned ${system} training to ${assignedCount} selected students`);
  renderFilteredStudents();
}

function getStudentAssignmentProgress(student){
  if (!student || !student.assigned || !student.assigned.length) return '';
  return student.assigned.map(a => `${a.system}: ${ (a.completed || []).length }/${ (a.scenarios || []).length }`).join(' | ');
}

// Recommendation: top 3 scenarios for a system
function getRecommendedScenarios(system){
  if (!system) return [];
  return (scenarios || []).filter(s => s.primarySystem === system).slice(0,3);
}

function studentWeakInSystem(student, system){
  const replays = student.replays || [];
  const relevant = replays.filter(r => {
    const sys = (r.actions || []).find(a => a.type === 'system');
    return sys && String(sys.value) === String(system);
  });
  if (!relevant.length) return true; // no data -> treat as weak
  const correct = relevant.filter(r => isCorrectDiagnosis(r)).length;
  const pct = correct / relevant.length;
  return pct < 0.7; // threshold
}

function assignTraining(system){
  if (!system) return alert('No system selected for assignment');
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const rec = getRecommendedScenarios(system);
  let assignedCount = 0;
  const updated = classData.map(student => {
    if (!studentWeakInSystem(student, system)) return student;
    student.assigned = student.assigned || [];
    student.assigned.push({ system, scenarios: rec.map(s => s.id), completed: [], date: Date.now() });
    assignedCount++;
    return student;
  });
  localStorage.setItem('carSim_class', JSON.stringify(updated));
  alert(`Assigned ${rec.length} ${system} scenarios to ${assignedCount} weak students`);
  // refresh view
  renderFilteredStudents();
}

function markScenarioComplete(student, scenarioId){
  if (!student || !student.assigned) return;
  student.assigned.forEach(a => {
    if (a.scenarios && a.scenarios.includes(scenarioId)){
      a.completed = a.completed || [];
      if (!a.completed.includes(scenarioId)) a.completed.push(scenarioId);
    }
  });
  // attempt to record completion to backend
  try {
    if (typeof currentUser !== 'undefined' && currentUser && !demoMode){
      apiPost('/api/complete', { userId: currentUser, scenarioId, classId: currentClassId });
    }
  } catch(e){}
}

function getStudentRecord(name){
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  const found = classData.find(s => s.name === name);
  if (found) return found;
  const saved = JSON.parse(localStorage.getItem('carSim_' + name) || 'null');
  return saved || null;
}

function renderAssignedWork(student){
  const el = document.getElementById('assignedWork');
  if (!el) return;
  if (!student || !student.assigned || !student.assigned.length){ el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `\n    <h3>Assigned Training</h3>\n    ${student.assigned.map(a => { const done = (a.completed || []).length; const total = (a.scenarios || []).length; return `\n      <div style="margin-bottom:8px;">\n        <strong>${a.system}</strong><br>\n        ${done}/${total} completed\n      </div>\n    `; }).join('')}\n  `;
}

function analyzeClassWeakness(classData){
  const systems = {};
  (classData || []).forEach(student => {
    (student.replays || []).forEach(r => {
      const sysAct = (r.actions || []).find(a => a.type === 'system');
      if (!sysAct) return;
      const system = sysAct.value || 'other';
      if (!systems[system]) systems[system] = { correct:0, total:0 };
      systems[system].total++;
      if (isCorrectDiagnosis(r)) systems[system].correct++;
    });
  });
  return Object.entries(systems).map(([system,stats]) => ({ system, pct: stats.total ? stats.correct / stats.total : 0, total: stats.total })).sort((a,b)=> a.pct - b.pct);
}

function countWeakStudents(classData, system){
  return (classData || []).filter(s => studentWeakInSystem(s, system)).length;
}

function generateAutoRecommendations(classData){
  const analysis = analyzeClassWeakness(classData);
  return analysis.slice(0,3).map(item => ({
    system: item.system,
    accuracy: Math.round((item.pct || 0) * 100),
    weakStudents: countWeakStudents(classData, item.system),
    scenarios: getRecommendedScenarios(item.system)
  }));
}

function renderAutoRecommendations(classData){
  const el = document.getElementById('autoRecommendations');
  if (!el) return;
  const recs = generateAutoRecommendations(classData);
  if (!recs.length) { el.innerHTML = '<p style="color:var(--muted)">No recommendations available</p>'; return; }
  el.innerHTML = recs.map(r => `\n    <div class="card" style="margin-bottom:10px; padding:10px">\n      <strong>${r.system}</strong><br>\n      Accuracy: ${r.accuracy}%<br>\n      Weak Students: ${r.weakStudents}<br>\n      <div style="margin-top:8px">\n        <button class="btn-assign-rec" data-system="${r.system}">Assign ${r.system} Training</button>\n      </div>\n    </div>\n  `).join('');

  // attach assign listeners
  setTimeout(() => {
    const btns = el.querySelectorAll('.btn-assign-rec');
    btns.forEach(b => { const sys = b.getAttribute('data-system'); if (!sys) return; b.addEventListener('click', () => assignTraining(sys)); });
  }, 0);
}

function renderStudentRecommendations(student){
  if (!student) return;
  // pick top weak system from profile, fallback to analysis of replays
  const profile = student.studentProfile || {};
  let topSystem = null;
  if (profile.weakSystems){
    const entries = Object.entries(profile.weakSystems || {}).sort((a,b)=> b[1]-a[1]);
    if (entries.length) topSystem = entries[0][0];
  }
  if (!topSystem){
    // fallback: analyze student's replays to find weakest
    const analysis = analyzeClassWeakness([student]);
    if (analysis && analysis.length) topSystem = analysis[0].system;
  }
  const el = document.getElementById('assignedWork');
  if (!el) return;
  const recs = topSystem ? getRecommendedScenarios(topSystem) : [];
  if (!recs.length) return;
  // append recommendations below assigned work
  const markup = `\n    <div class="student-recs" style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.03); padding-top:10px">\n      <h4>Recommended Practice</h4>\n      <div>Target: <strong>${topSystem}</strong></div>\n      ${recs.map(s => `<div style="margin-top:6px">${s.id || s.index} — ${s.primarySystem || ''} • Difficulty ${s.difficulty || ''} <button class="btn-start-scenario" data-id="${s.id || s.index}" style="margin-left:8px">Start</button></div>`).join('')}\n    </div>\n  `;
  el.innerHTML = (el.innerHTML || '') + markup;
  // attach start listeners
  setTimeout(() => {
    const starts = el.querySelectorAll('.btn-start-scenario');
    starts.forEach(b => { const id = b.getAttribute('data-id'); if (!id) return; b.addEventListener('click', () => startScenarioById(id)); });
  }, 0);
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
  // if last explanation was correct, mark assigned scenario completed
  try {
    if (lastExplanation && (lastExplanation.final === 'Correct' || lastExplanation.outcome === 'correct')){
      markScenarioComplete(student, lastExplanation.scenarioIndex || currentIndex);
    }
  } catch(e){}
  if (existingIndex >= 0) classData[existingIndex] = student;
  else classData.push(student);
  localStorage.setItem('carSim_class', JSON.stringify(classData));
  // attempt to send replay to backend (best-effort)
  try {
    if (!demoMode && currentUser){
      const payload = { userId: currentUser, scenarioId: currentIndex, actions: student.replays && student.replays.length ? student.replays[student.replays.length-1].actions : [], result: (lastExplanation && lastExplanation.final) || null, confidence: (lastExplanation && lastExplanation.confidence) || null, classId: currentClassId };
      apiPost('/api/replay', payload);
    }
  } catch(e){}
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
    // ensure teacher is signed into Supabase before calling protected endpoints
    try {
      const token = getAccessToken();
      if (!token) {
        const signed = await teacherLoginPrompt();
        if (!signed) { showToast('Teacher sign-in required'); return; }
      }

      // attempt to load or create a class for this teacher
      const list = await getClasses();
      const classes = (list && list.classes) ? list.classes : (list && list.length ? list : []);
      if (classes && classes.length){
        // pick first by default
        currentClassId = classes[0].id;
        currentClassCode = classes[0].class_code || null;
        localStorage.setItem('carSim_currentClassId', currentClassId);
        localStorage.setItem('carSim_currentClassCode', currentClassCode || '');
      } else {
        // create a default class
        const created = await createClass(currentUser + "'s Class");
        if (created && created.success && created.class){
          currentClassId = created.class.id;
          currentClassCode = created.class.class_code || null;
          localStorage.setItem('carSim_currentClassId', currentClassId);
          localStorage.setItem('carSim_currentClassCode', currentClassCode || '');
        }
      }
    } catch(e){ console.warn('Class load/create failed', e); }
    setView('teacherScreen');
    await loadTeacherData();
    return;
  }

  // STUDENT flow: if teacher has assigned a scenario, start it; otherwise show selection
  await loadUserData();
  AppState.profile = studentProfile || {};
  // render assigned work for student after loading profile
  try {
    const studentRecord = getStudentRecord(currentUser);
    renderAssignedWork(studentRecord);
  } catch(e){}
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
  // If currentClassId is set, try to load class-scoped teacher data from backend
  if (currentClassId) {
    try {
      const resp = await apiGet(`/api/teacher/data?classId=${encodeURIComponent(currentClassId)}`);
      if (resp && resp.users && resp.replays) {
        // transform API data into classData shape used by UI
        const users = resp.users || [];
        const replays = resp.replays || [];
        const completions = resp.completions || [];
        const enrolls = resp.enrollments || [];
        const classData = users.map(u => {
          const uid = u.id || u.user_id || '';
          const name = u.email || u.name || uid;
          const userReplays = replays.filter(r => String(r.user_id) === String(uid)).map(r => ({ scenario: r.scenario_id, actions: r.actions || [], savedAt: r.created_at }));
          return { name, id: uid, replays: userReplays, explanations: [], studentProfile: {}, completed: completions.some(c => String(c.user_id) === String(uid)) };
        });
        if (!classData.length) container.innerHTML = '<p>No student data yet.</p>';
        // attach to local rendering functions
        try { renderFilteredStudents(classData); } catch(e){ renderFilteredStudents(); }
        try { renderConfidenceChart(classData); } catch(e) { console.warn('Confidence chart render failed', e); }
        try { renderSystemHeatmap(classData); } catch(e) { console.warn('System heatmap render failed', e); }
        try { renderAutoRecommendations(classData); } catch(e) { console.warn('Auto recommendations render failed', e); }
        return;
      }
    } catch (e) { console.warn('Failed to load class-scoped teacher data', e); }
  }

  // Fallback to localStorage when backend not available or class not selected
  const classData = JSON.parse(localStorage.getItem('carSim_class')) || [];
  if (classData.length === 0){ container.innerHTML = '<p>No student data yet.</p>'; return; }
  // render student list (supports active system filter)
  renderFilteredStudents();
  // render confidence chart for class
  try { renderConfidenceChart(classData); } catch(e) { console.warn('Confidence chart render failed', e); }
  try { renderSystemHeatmap(classData); } catch(e) { console.warn('System heatmap render failed', e); }
  try { renderAutoRecommendations(classData); } catch(e) { console.warn('Auto recommendations render failed', e); }
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
  // Ensure viewer is visible upfront so any later errors won't leave it hidden
  try {
    console.log('showReplay invoked', student && (student.id || student.name || '[no-id]'));
    viewer.style.display = 'block';
    viewer.hidden = false;
    viewer.classList.remove('hidden');
    viewer.style.visibility = 'visible';
  } catch(e){}

  // show a loading placeholder immediately so headless tests can observe content
  try { timeline.innerHTML = '<div class="replay-loading">Loading replay...</div>'; } catch(e){}

  const replays = (student && student.replays) || [];
  if (!replays.length){
    console.log('showReplay: no replays for student', student && (student.id || student.name));
    timeline.innerHTML = '<p>No replay data available for this student.</p>';
    return;
  }
  // show most recent replay by default
  const last = replays[replays.length - 1];
  timeline.innerHTML = '';
  const actions = last.actions || [];
  // validate actions exist
  if (!Array.isArray(actions) || actions.length === 0){
    console.log('showReplay: replay has no actions', last);
    timeline.innerHTML = '<p>No actions recorded in this replay.</p>';
    return;
  }
  console.log('showReplay: rendering', actions.length, 'actions; sample:', actions[0]);
  actions.forEach((a, idx) => {
    const el = document.createElement('div'); el.className = 'replay-item'; el.setAttribute('data-idx', idx);
    const t = document.createElement('span'); t.className = 'replay-time'; t.innerText = new Date(a.time).toLocaleTimeString();
    const prev = idx > 0 ? actions[idx - 1] : null;
    const content = document.createElement('span'); content.innerHTML = formatReplayActionWithDelta(a, prev);
    // highlight wrong actions against scenario if possible
    const scen = (typeof last.scenario === 'number' && scenarios[last.scenario]) ? scenarios[last.scenario] : null;
    const wrong = isWrongAction(a, scen);
    if (wrong) {
      el.classList.add('wrong');
      const tag = document.createElement('span'); tag.className = 'tag'; tag.innerText = 'Incorrect';
      content.appendChild(tag);
    }
    el.appendChild(t); el.appendChild(content);
    timeline.appendChild(el);
  });
  // summary at top
  const summaryHtml = `<div class="replay-summary"><strong>Outcome:</strong> ${last.result || last.lastResult || '—'}</div>`;
  timeline.insertAdjacentHTML('afterbegin', summaryHtml);

  // wire playback controls for this replay
  // ensure any previous playback is stopped when opening a new replay
  stopReplay();
  const playBtn = document.getElementById('replay-play');
  const stopBtn = document.getElementById('replay-stop');
  const speedSel = document.getElementById('replay-speed');
  if (playBtn) {
    try { playBtn.removeEventListener('click', playBtn._replayHandler); } catch(e){}
    const playHandler = () => playReplay(actions, speedSel ? Number(speedSel.value) : 800);
    playBtn.addEventListener('click', playHandler);
    playBtn._replayHandler = playHandler;
  }
  if (stopBtn) {
    try { stopBtn.removeEventListener('click', stopBtn._stopHandler); } catch(e){}
    const stopHandler = () => stopReplay();
    stopBtn.addEventListener('click', stopHandler);
    stopBtn._stopHandler = stopHandler;
  }

  // final visibility enforcement in case other code toggles display
  try {
    viewer.style.display = 'block';
    viewer.hidden = false;
    viewer.classList.remove('hidden');
    viewer.style.visibility = 'visible';
  } catch(e){}
}

let replayTimer = null;

function highlightStep(index){
  const items = document.querySelectorAll('.replay-item');
  items.forEach((el, i) => el.classList.toggle('active', i === index));
  const cur = document.querySelector('.replay-item.active');
  if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function playReplay(actions, baseMs){
  // Prevent overlap
  stopReplay();
  if (!actions || !actions.length) return;
  // Reset previous highlights
  document.querySelectorAll('.replay-item').forEach(el => el.classList.remove('active'));

  const speedBase = baseMs || 800;
  const speedFactor = speedBase / 800;
  let i = 0;

  function step(){
    if (i >= actions.length){ stopReplay(); return; }
    highlightStep(i);
    const prevTime = actions[i-1]?.time;
    let delay = speedBase;
    if (prevTime){
      const raw = actions[i].time - prevTime;
      delay = Math.min(Math.max(raw, 200), 3000) * speedFactor;
    }
    replayTimer = setTimeout(() => { i++; step(); }, delay);
  }

  step();
}

function stopReplay(){
  if (replayTimer){ clearTimeout(replayTimer); replayTimer = null; }
  document.querySelectorAll('.replay-item.active').forEach(el => el.classList.remove('active'));
}

// Expose helpers to `window` so external scripts/tests can call them reliably
try {
  if (typeof window !== 'undefined'){
    window.showReplay = showReplay;
    window.openStudentDetail = openStudentDetail;
  }
} catch(e){}

function formatReplayActionWithDelta(a, prev){
  const time = new Date(a.time).toLocaleTimeString();
  let delta = '';
  if (prev && prev.time) {
    const diff = Math.round((a.time - prev.time) / 1000);
    delta = ` <span style="color:var(--muted);font-size:0.9rem">(+${diff}s)</span>`;
  }
  return `[${time}] ` + actionLabel(a) + delta;
}

function actionLabel(a){
  if (!a || !a.type) return '';
  switch(a.type){
    case 'system': return `Selected system: <strong>${a.value}</strong>` + (a.justification ? ` — ${a.justification}` : '');
    case 'tool': return `Used tool: <strong>${a.value}</strong>`;
    case 'diagnosis': return `Diagnosis: <strong>${a.value}</strong>`;
    case 'confidence': return `Confidence: <strong>${a.value}</strong>`;
    default: return `${a.type}: ${JSON.stringify(a)}`;
  }
}

function isWrongAction(a, scenario){
  if (!a || !scenario) return false;
  if (a.type === 'system'){
    return String(a.value).toLowerCase() !== String(scenario.primarySystem || '').toLowerCase();
  }
  if (a.type === 'diagnosis'){
    const expected = scenario.fault || scenario.correct || scenario.answer || '';
    return String(a.value).toLowerCase() !== String(expected).toLowerCase();
  }
  return false;
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
  // class UI handlers
  const teacherControls = document.getElementById('teacherClassControls');
  const studentControls = document.getElementById('studentClassControls');
  const teacherSelect = document.getElementById('teacherClassesSelect');
  const roleSel = document.getElementById('role');
  if (roleSel){
    roleSel.onchange = () => {
      if (roleSel.value === 'teacher') { if (teacherControls) teacherControls.style.display = 'block'; if (studentControls) studentControls.style.display = 'none'; }
      else { if (teacherControls) teacherControls.style.display = 'none'; if (studentControls) studentControls.style.display = 'block'; }
    };
  }
  // create class
  const createBtn = document.getElementById('btn-create-class');
  if (createBtn) createBtn.onclick = async () => {
    const name = (document.getElementById('newClassName') || {}).value || (currentUser ? (currentUser + "'s Class") : 'New Class');
    // require teacher sign-in before attempting backend create
    const token = getAccessToken();
    if (!token) {
      const signed = await teacherLoginPrompt();
      if (!signed) { showToast('Teacher sign-in required'); return; }
    }
    if (!name) return alert('Enter a class name');
    showToast('Creating class...');
    const res = await createClass(name);
    if (res && res.success && res.class){
      currentClassId = res.class.id;
      currentClassCode = res.class.class_code || null;
      localStorage.setItem('carSim_currentClassId', currentClassId);
      localStorage.setItem('carSim_currentClassCode', currentClassCode || '');
      // refresh teacher classes select
      try { await loadTeacherClasses(); } catch(e){}
      showToast('Class created');
      setView('teacherScreen');
      await loadTeacherData();
    } else {
      showToast('Failed to create class (backend unavailable). Saved locally');
      currentClassId = 'local-' + Date.now();
      currentClassCode = Math.random().toString(36).slice(2,8).toUpperCase();
      localStorage.setItem('carSim_currentClassId', currentClassId);
      localStorage.setItem('carSim_currentClassCode', currentClassCode);
      setView('teacherScreen');
      await loadTeacherData();
    }
  };

  // join class (student)
  const joinBtn = document.getElementById('btn-join-class');
  if (joinBtn) joinBtn.onclick = async () => {
    const code = (document.getElementById('joinClassCode') || {}).value.trim();
    if (!code) return alert('Enter a class code to join');
    showToast('Joining class...');
    const found = await findClassByCode(code);
    if (found && (found.id || (found.class && found.class.id))){
      const cls = found.class || found;
      const res = await enrollInClass(cls.id, code);
      if (res && res.success){
        currentClassId = cls.id;
        currentClassCode = cls.class_code || code;
        localStorage.setItem('carSim_currentClassId', currentClassId);
        localStorage.setItem('carSim_currentClassCode', currentClassCode || '');
        showToast('Joined class');
        // proceed to student flow
        setView('scenarioSelectScreen');
        renderScenarioList();
      } else {
        showToast('Failed to join class.');
      }
    } else {
      showToast('Class code not found');
    }
  };

  // load teacher classes into select
  async function loadTeacherClasses(){
    const sel = document.getElementById('teacherClassesSelect');
    if (!sel) return;
    sel.innerHTML = '';
    try {
      // ensure teacher is signed in before calling protected endpoint
      const token = getAccessToken();
      if (!token) {
        const signed = await teacherLoginPrompt();
        if (!signed) { showToast('Teacher sign-in required to load classes'); return; }
      }
      const resp = await getClasses();
      const classes = (resp && resp.classes) ? resp.classes : (resp && resp.length ? resp : []);
      // add a small class info container for code + copy
      let info = document.getElementById('teacherClassInfo');
      if (!info){ info = document.createElement('div'); info.id = 'teacherClassInfo'; info.style.marginTop = '8px'; sel.parentNode.insertBefore(info, sel.nextSibling); }
      info.innerHTML = '';
      classes.forEach(c => {
        const opt = document.createElement('option'); opt.value = c.id; opt.innerText = c.name + (c.class_code ? ` (${c.class_code})` : '');
        sel.appendChild(opt);
      });
      if (currentClassId) sel.value = currentClassId;
      sel.onchange = async () => {
        currentClassId = sel.value;
        localStorage.setItem('carSim_currentClassId', currentClassId || '');
        await loadTeacherData();
        // update class info display
        const cls = classes.find(x=>x.id===currentClassId);
        const info = document.getElementById('teacherClassInfo');
        if (info){
          if (cls && cls.class_code){
            info.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div>Code: <strong>${escapeHtml(cls.class_code)}</strong></div><div><button id=\"copyInvite\">Copy</button></div></div>`;
            const copy = document.getElementById('copyInvite'); if (copy) copy.onclick = () => copyToClipboard(cls.class_code || '');
          } else { info.innerHTML = ''; }
        }
      };
      // populate initial info for selected class
      if (currentClassId){ const cls = classes.find(x=>x.id===currentClassId); if (cls && cls.class_code){ const infoEl = document.getElementById('teacherClassInfo'); infoEl.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div>Code: <strong>${escapeHtml(cls.class_code)}</strong></div><div><button id=\"copyInvite\">Copy</button></div></div>`; const copy = document.getElementById('copyInvite'); if (copy) copy.onclick = () => copyToClipboard(cls.class_code || ''); } }
    } catch(e){ console.warn('Failed to load teacher classes', e); }
  }

  // ensure teacher classes loaded when teacher view active
  if (teacherSelect && roleSel && roleSel.value === 'teacher') loadTeacherClasses();

  // When a teacher signs in, remove any local fallback class IDs
  window.addEventListener('supabase:authExpired', ()=>{});

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

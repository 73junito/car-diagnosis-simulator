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
}

function loadScenario(){
  const s = currentScenario();
  // reset per-scenario evidence and counters
  evidence = { electrical:[], fuel:[], ignition:[], air:[], ecu:[], engine:[], cooling:[], hvac:[], transmission:[], other:[] };
  toolUses = 0;
  selectedSystem = null;
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
  // compute adaptive weight: base by system importance, boost if matches selected system, boost if interpretation indicates problem
  const baseImportance = systemWeights[output.system] || 0.5;
  const isolationBoost = (selectedSystem && selectedSystem === output.system) ? 1.2 : 1.0;
  const problemBoost = (/problem|low|no|<12v|0 psi|leak|misfire/i.test(output.reading + ' ' + output.interpretation)) ? 1.4 : 1.0;
  output.weight = +(baseImportance * isolationBoost * problemBoost).toFixed(2);
  evidence[output.system].push(output);

  // annotate evidence with current selected system context
  output.contextSystem = selectedSystem || 'unspecified';

  // display friendly evidence
  document.getElementById('result').innerText = `${component.toUpperCase()} → ${output.reading} (${output.interpretation})`;
  if(toolUses > 2){
    score = Math.max(0, score - 2);
    document.getElementById('score').innerText = `Score: ${score}`;
  }
  document.getElementById('toolsLeft').innerText = `Tools left: ${maxToolUses - toolUses}`;
  saveProgress();
}

function selectSystem(sys){
  selectedSystem = sys;
  const panel = document.getElementById('systemPanel');
  if (panel) panel.style.display = 'none';
  document.getElementById('result').innerText = `🔧 System selected: ${sys.toUpperCase()}. Now use tools to gather evidence.`;
  // small hint: show confidence panel only after diagnosis; ensure it's hidden
  const conf = document.getElementById('confidencePanel');
  if (conf) conf.style.display = 'none';
  // record selection in evidence as a starting note
  if (!evidence[sys]) evidence[sys] = [];
  evidence[sys].push({ system: sys, reading: 'SYSTEM ISOLATION', interpretation: 'SELECTED', source: 'systemSelection', weight: (systemWeights[sys] || 0.5) });
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
      relevance: +relevance.toFixed(2),
      evidenceSum: +evidenceSum.toFixed(2),
      totalSum: +totalSum.toFixed(2),
      topEvidence,
      isolationCorrect,
      confidence: conf,
      scoreDelta: correct ? (confScore + isolationBonus) : -5,
      final: correct ? 'Correct' : 'Incorrect'
    };

    // render into DOM
    const panel = document.getElementById('explanationPanel');
    if (panel) panel.style.display = 'block';
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    setText('exp-system', lastExplanation.selectedSystem || '—');
    setText('exp-relevance', Math.round(lastExplanation.relevance * 100) + '%');
    setText('exp-isolation', lastExplanation.isolationCorrect ? 'Correct' : 'Incorrect');
    setText('exp-confidence', lastExplanation.confidence);
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
});

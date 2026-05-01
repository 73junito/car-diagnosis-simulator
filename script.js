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

async function saveProgress(){
  if (!currentUser) return;

  const student = {
    name: currentUser,
    score,
    correct: correctAnswers,
    wrong: wrongAnswers,
    currentLevel: currentIndex,
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
}

function loadScenario(){
  const s = currentScenario();
  toolUses = 0;
  document.getElementById('symptoms').innerText = s.symptoms;
  document.getElementById('result').innerText = '';
  document.getElementById('progress').innerText = `Scenario ${currentIndex + 1} of ${total}`;
  document.getElementById('score').innerText = `Score: ${score}`;
  document.getElementById('toolsLeft').innerText = `Tools left: ${maxToolUses - toolUses}`;
  const dl = document.getElementById('download-report');
  if (dl) dl.style.display = 'none';
  document.getElementById('userInfo').innerText = currentUser ? `Student: ${currentUser}` : '';
}

function check(component){
  const s = currentScenario();
  if(toolUses >= maxToolUses){
    document.getElementById('result').innerText = '⚠️ No tool uses left!';
    return;
  }

  toolUses++;
  totalToolUsed++;

  const result = (s.tests && s.tests[component]) || (component === 'obd' ? (s.obd || 'No stored OBD codes.') : 'No issue found.');
  document.getElementById('result').innerText = result;
  if(toolUses > 2){
    score = Math.max(0, score - 2);
    document.getElementById('score').innerText = `Score: ${score}`;
  }
  document.getElementById('toolsLeft').innerText = `Tools left: ${maxToolUses - toolUses}`;
  saveProgress();
}

async function diagnose(choice){
  const s = currentScenario();
  const out = document.getElementById('result');
  if(choice === s.fault){
    correctAnswers++;
    score += 10;
    out.innerText = '✅ Correct diagnosis! +10 points';
    document.getElementById('score').innerText = `Score: ${score}`;

    currentIndex++;
    await saveProgress();
    if(currentIndex < scenarios.length){
      setTimeout(loadScenario, 1200);
    } else {
      setTimeout(endGame, 800);
    }
  } else {
    wrongAnswers++;
    score = Math.max(0, score - 10);
    out.innerText = '❌ Incorrect diagnosis! -10 points';
    document.getElementById('score').innerText = `Score: ${score}`;
    await saveProgress();
  }
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
});

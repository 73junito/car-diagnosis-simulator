// Minimal student progress persistence utilities
(function(){
  const PROGRESS_KEY = 'student_progress';
  const LAST_KEY = 'last_scenario';

  function safeParse(v){
    try{ return JSON.parse(v); }catch(e){ return null; }
  }

  function loadProgress(){
    const raw = localStorage.getItem(PROGRESS_KEY);
    const data = safeParse(raw);
    return data && typeof data === 'object' ? data : {};
  }

  function saveProgress(obj){
    try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify(obj||{})); return true; }catch(e){ return false; }
  }

  function getProgressFor(id){
    if(!id) return null;
    const p = loadProgress();
    return p[id] || null;
  }

  function setProgressFor(id, status, score){
    if(!id) return;
    const p = loadProgress();
    p[id] = p[id] || {};
    p[id].status = status || p[id].status || 'not-started';
    if(typeof score === 'number') p[id].score = score;
    p[id].updated = (new Date()).toISOString();
    saveProgress(p);
  }

  function clearProgress(){
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(LAST_KEY);
  }

  function setLastScenario(id){
    if(!id) return;
    const obj = { id: id, updated: (new Date()).toISOString() };
    try{ localStorage.setItem(LAST_KEY, JSON.stringify(obj)); }catch(e){ /* ignore storage errors */ }
  }

  function getLastScenario(){
    const raw = localStorage.getItem(LAST_KEY);
    const obj = safeParse(raw);
    return obj && obj.id ? obj : null;
  }

  // Expose API
  window.studentProgress = {
    loadProgress, saveProgress, getProgressFor, setProgressFor, clearProgress, setLastScenario, getLastScenario,
  };

})();

(function(){
  // Simple in-memory attempt store for current browser session only.
  const store = {};

  function saveAttempt(scenario, data){
    if(!scenario) return;
    store[scenario] = Object.assign({}, data);
    return store[scenario];
  }

  function loadAttempt(scenario){
    if(!scenario) return null;
    return store[scenario] ? Object.assign({}, store[scenario]) : null;
  }

  function resetAttempt(scenario){
    if(scenario){ delete store[scenario]; } else { Object.keys(store).forEach(k=>delete store[k]); }
  }

  function getAll(){ return Object.assign({}, store); }

  window.attemptStore = { saveAttempt, loadAttempt, resetAttempt, getAll };
})();

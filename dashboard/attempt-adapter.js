/* Adapter that selects Supabase adapter when enabled, otherwise falls back to in-memory attemptStore */
(function(){
  function useSupabase(){
    // feature flag via window.USE_SUPABASE_ATTEMPTS (truthy string '1' or boolean true) or presence of SUPABASE_URL
    if(typeof window === 'undefined') return false;
    if(window.USE_SUPABASE_ATTEMPTS === true || window.USE_SUPABASE_ATTEMPTS === '1') return true;
    if(window.SUPABASE_URL) return true;
    return false;
  }

  function getAdapter(){
    if(useSupabase() && window.attemptSupabase) return window.attemptSupabase;
    if(window.attemptStore) return window.attemptStore;
    // minimal no-op adapter
    return { saveAttempt: ()=>{}, loadAttempt: ()=>null, resetAttempt: ()=>{} };
  }

  function saveAttempt(scenario, attempt){
    const a = getAdapter();
    try{ return a.saveAttempt(scenario, attempt); }catch(e){ /* swallow */ }
  }

  function loadAttempt(scenario){
    const a = getAdapter();
    try{ return a.loadAttempt(scenario); }catch(e){ return null; }
  }

  function resetAttempt(scenario){
    const a = getAdapter();
    try{ return a.resetAttempt && a.resetAttempt(scenario); }catch(e){ /* ignore */ }
  }

  window.attemptAdapter = { saveAttempt, loadAttempt, resetAttempt, _getAdapter: getAdapter };
})();

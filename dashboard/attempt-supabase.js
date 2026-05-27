/* Supabase attempt persistence adapter (client-side) - graceful fallback to in-memory store */
/* global supabase */
(function(){
  const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || window.SUPABASE_URL || null;
  const SUPABASE_KEY = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_KEY) || window.SUPABASE_KEY || null;

  // Lazy client creation to allow tests to mock
  let _client = null;
  function getClient(){
    if(_client) return _client;
    if(!SUPABASE_URL || !SUPABASE_KEY) return null;
    // create supabase client if available
    if(typeof supabase !== 'undefined' && supabase.createClient){
      _client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return _client;
    }
    return null;
  }

  async function saveAttemptRemote(scenario, attempt){
    const client = getClient();
    if(!client) return Promise.reject(new Error('Supabase client not configured'));
    // This implementation is a stub for future server integration.
    // Save to `attempts` table: { scenario, data }
    return client.from('attempts').upsert({ scenario, data: attempt });
  }

  async function loadAttemptRemote(scenario){
    const client = getClient();
    if(!client) return Promise.reject(new Error('Supabase client not configured'));
    const { data, error } = await client.from('attempts').select('data').eq('scenario', scenario).limit(1).single();
    if(error) throw error;
    return data ? data.data : null;
  }

  async function saveAttempt(scenario, attempt){
    // try remote first, otherwise fallback to in-memory attemptStore
    try{
      const res = await saveAttemptRemote(scenario, attempt);
      return res;
    }catch(e){
      if(window.attemptStore) return window.attemptStore.saveAttempt(scenario, attempt);
      void e;
      throw e;
    }
  }

  async function loadAttempt(scenario){
    try{
      const res = await loadAttemptRemote(scenario);
      return res;
    }catch(e){
      if(window.attemptStore) return window.attemptStore.loadAttempt(scenario);
      void e;
      return null;
    }
  }

  window.attemptSupabase = { saveAttempt, loadAttempt, _getClient:getClient };
})();

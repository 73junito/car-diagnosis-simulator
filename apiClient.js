// Minimal API client helpers used by the frontend.
// Exposes global functions: apiGet(path), apiPost(path, body)
(function(){
  const API_BASE = (typeof window.API_BASE_URL !== 'undefined' && window.API_BASE_URL) ? String(window.API_BASE_URL).replace(/\/$/, '') : '';

  function getToken(){
    try { if (window.getAccessToken) return window.getAccessToken(); } catch(e){}
    return localStorage.getItem('supabase_access_token') || null;
  }

  async function apiFetch(method, path, body){
    const url = (path && path.startsWith('http')) ? path : (API_BASE ? (API_BASE + path) : path);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const token = getToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const opts = { method, headers, credentials: 'same-origin' };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e){ json = text; }
    if (!res.ok) {
      const err = new Error('API Error: ' + res.status);
      err.status = res.status; err.body = json; throw err;
    }
    return json;
  }

  // Install a global fetch monkey-patch once to attach Authorization header for API_BASE
  if (!window.__apiClientFetchPatched) {
    try {
      window.__apiClientFetchPatched = true;
      const origFetch = window.fetch.bind(window);
      window.fetch = async function(resource, init){
        try {
          let url = typeof resource === 'string' ? resource : (resource && resource.url) ? resource.url : '';
          const shouldAttach = API_BASE && url && url.startsWith(API_BASE);
          if (shouldAttach){
            init = init || {};
            init.headers = init.headers || {};
            const headers = new Headers(init.headers);
            const token = getToken();
            if (token) headers.set('Authorization', 'Bearer ' + token);
            init.headers = headers;
          }
          const resp = await origFetch(resource, init);
          try {
            const respUrl = (typeof resource === 'string') ? resource : (resource && resource.url) ? resource.url : '';
            if (respUrl && API_BASE && respUrl.startsWith(API_BASE) && (resp.status === 401 || resp.status === 403)){
              // on auth failure, clear local tokens and notify listeners
              try { if (window.supabaseSignOut) window.supabaseSignOut(); } catch(e){}
              try { window.dispatchEvent(new CustomEvent('supabase:authExpired', { detail: { status: resp.status } })); } catch(e){}
            }
          } catch(e){}
          return resp;
        } catch (e){ return Promise.reject(e); }
      };
    } catch(e){}
  }

  window.apiGet = async function(path){ return apiFetch('GET', path); };
  window.apiPost = async function(path, body){ return apiFetch('POST', path, body); };
})();

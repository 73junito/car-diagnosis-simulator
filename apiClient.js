// Minimal API client helpers used by the frontend.
// Exposes global functions: apiGet(path), apiPost(path, body), apiPatch(path, body), apiDelete(path)
(function(){
  const API_BASE = (typeof window.API_BASE_URL !== 'undefined' && window.API_BASE_URL) ? String(window.API_BASE_URL).replace(/\/$/, '') : '';

  function getToken(){
    try { if (window.getAccessToken) return window.getAccessToken(); } catch(e){ /* ignore: best-effort token retrieval */ }
    return localStorage.getItem('supabase_access_token') || null;
  }

  function isProtectedApiRequest(url){
    if (!url) return false;
    try {
      const parsed = new URL(url, window.location.origin);
      const apiBase = API_BASE ? new URL(API_BASE, window.location.origin) : null;
      if (apiBase && parsed.origin === apiBase.origin && parsed.pathname.startsWith('/api/')) return true;
      return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
    } catch(e){
      return String(url).startsWith('/api/');
    }
  }

  function handleAuthResponse(status, url){
    if (!isProtectedApiRequest(url)) return;
    if (status === 401){
      try { if (window.supabaseSignOut) window.supabaseSignOut(); } catch(e){ /* ignore: best-effort sign-out */ }
      try { window.dispatchEvent(new CustomEvent('supabase:authExpired', { detail: { status } })); } catch(e){ /* ignore: best-effort event dispatch */ }

      const path = String(window.location.pathname || '');
      if (path.startsWith('/dashboard/student/')){
        window.location.replace('/sign-in/student/');
      } else if (
        path.startsWith('/dashboard/instructor/') ||
        path.startsWith('/dashboard/admin/') ||
        path.startsWith('/dashboard/institution/') ||
        path.startsWith('/dashboard/author/')
      ){
        window.location.replace('/sign-in/instructor/');
      }
      return;
    }
    if (status === 403){
      try { window.dispatchEvent(new CustomEvent('supabase:authForbidden', { detail: { status } })); } catch(e){ /* ignore: best-effort event dispatch */ }
    }
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
            handleAuthResponse(resp.status, respUrl);
          } catch(e){ /* ignore: non-fatal response handling error */ }
          return resp;
        } catch (e){ return Promise.reject(e); }
      };
    } catch(e){ /* ignore: fetch patch failed */ }
  }

  window.apiGet = async function(path){ return apiFetch('GET', path); };
  window.apiPost = async function(path, body){ return apiFetch('POST', path, body); };
  window.apiPatch = async function(path, body){ return apiFetch('PATCH', path, body); };
  window.apiDelete = async function(path){ return apiFetch('DELETE', path); };
})();

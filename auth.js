// Lightweight Supabase-auth helpers (frontend).
// Exposes globals: supabaseSignIn, supabaseSignUp, supabaseRequestPasswordReset, supabaseUpdatePassword, supabaseSignOut, getAccessToken, getAuthErrorMessage, clearLocalFallbackOnAuth
(function(){
  function showToast(msg, timeout=3000){
    try { if (window.showToast) return window.showToast(msg, timeout); } catch(e){ void e; }
    let t = document.getElementById('carSim_toast');
    if (!t){ t = document.createElement('div'); t.id = 'carSim_toast'; t.style.position='fixed'; t.style.right='12px'; t.style.top='12px'; t.style.zIndex=10000; document.body.appendChild(t); }
    const el = document.createElement('div'); el.style.background='rgba(0,0,0,0.8)'; el.style.color='white'; el.style.padding='8px 12px'; el.style.marginTop='8px'; el.style.borderRadius='6px'; el.innerText = msg;
    t.appendChild(el); setTimeout(()=>{ el.remove(); }, timeout);
  }

  function tokenEmail(accessToken){
    try {
      const payload = String(accessToken || '').split('.')[1]
      if (!payload) return ''
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
      return JSON.parse(atob(padded))?.email || ''
    } catch {
      return ''
    }
  }

  function storeSession(body, email){
    if (!body?.access_token) return;
    localStorage.setItem('supabase_access_token', body.access_token);
    localStorage.setItem('supabase_refresh_token', body.refresh_token || '');
    const resolvedEmail = email || tokenEmail(body.access_token)
    if (resolvedEmail) localStorage.setItem('supabase_user_email', resolvedEmail);
  }

  function consumeAuthRedirect(){
    const rawHash = String(window.location.hash || '').replace(/^#/, '')
    if (!rawHash) return false

    const params = new URLSearchParams(rawHash)
    const redirectType = params.get('type') || ''
    const errorCode = params.get('error_code') || params.get('error') || ''
    const errorDescription = params.get('error_description') || ''
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token') || ''

    if (
      !accessToken &&
      !refreshToken &&
      !redirectType &&
      !errorCode &&
      !errorDescription
    ) {
      return false
    }

    if (errorCode || errorDescription) {
      sessionStorage.setItem(
        'supabase_auth_redirect_error',
        JSON.stringify({
          code: errorCode,
          description: errorDescription
        })
      )
    }

    if (redirectType) {
      sessionStorage.setItem('supabase_auth_redirect_type', redirectType)
    }

    if (accessToken) {
      storeSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
    }

    const cleanUrl = window.location.pathname + window.location.search
    window.history.replaceState({}, document.title, cleanUrl)
    return Boolean(accessToken || errorCode || errorDescription || redirectType)
  }

  async function supabaseSignIn(email, password){
    const url = (window.SUPABASE_URL || '').replace(/\/$/, '');
    const anon = window.SUPABASE_ANON_KEY || '';
    if (!url || !anon) return { error: 'Supabase not configured' };
    try {
      const res = await fetch(url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'apikey': anon, 'Accept':'application/json' },
        body: JSON.stringify({ email, password })
      });
      const body = await res.json();
      if (!res.ok) return body;
      storeSession(body, email);
      return body;
    } catch(e){ return { error: e.message || String(e) }; }
  }

  async function supabaseSignUp(email, password, options = {}){
    const url = (window.SUPABASE_URL || '').replace(/\/$/, '');
    const anon = window.SUPABASE_ANON_KEY || '';
    if (!url || !anon) return { error: 'Supabase not configured' };
    const redirectTo = String(options.redirectTo || '').trim();
    const endpoint = url + '/auth/v1/signup' +
      (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : '');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'apikey': anon, 'Accept':'application/json' },
        body: JSON.stringify({
          email,
          password,
          data: options.data || {}
        })
      });
      const body = await res.json();
      if (!res.ok) return body;
      storeSession(body, email);
      return body;
    } catch(e){ return { error: e.message || String(e) }; }
  }

  async function supabaseRequestPasswordReset(email, redirectTo){
    const url = (window.SUPABASE_URL || '').replace(/\/$/, '');
    const anon = window.SUPABASE_ANON_KEY || '';
    if (!url || !anon) return { error: 'Supabase not configured' };

    const target = String(redirectTo || '').trim();
    const endpoint = url + '/auth/v1/recover' +
      (target ? '?redirect_to=' + encodeURIComponent(target) : '');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'apikey': anon,
          'Accept':'application/json'
        },
        body: JSON.stringify({ email })
      });

      let body = {};
      try { body = await res.json(); } catch { body = {}; }
      if (!res.ok) return body;
      return { ok: true };
    } catch(e){
      return { error: e.message || String(e) };
    }
  }

  async function supabaseUpdatePassword(password){
    const url = (window.SUPABASE_URL || '').replace(/\/$/, '');
    const anon = window.SUPABASE_ANON_KEY || '';
    const token = getAccessToken();
    if (!url || !anon) return { error: 'Supabase not configured' };
    if (!token) return { error: 'Recovery session is missing or expired' };

    try {
      const res = await fetch(url + '/auth/v1/user', {
        method: 'PUT',
        headers: {
          'Content-Type':'application/json',
          'apikey': anon,
          'Authorization': 'Bearer ' + token,
          'Accept':'application/json'
        },
        body: JSON.stringify({ password })
      });
      const body = await res.json();
      if (!res.ok) return body;
      return body;
    } catch(e){
      return { error: e.message || String(e) };
    }
  }

  function getAuthErrorMessage(result, fallback = 'Authentication failed.'){
    const code = String(
      result?.code ||
      result?.error_code ||
      (typeof result?.error === 'string' && /^[a-z0-9_]+$/i.test(result.error)
        ? result.error
        : '')
    ).toLowerCase();

    const raw = String(
      result?.error_description ||
      result?.msg ||
      result?.message ||
      (typeof result?.error === 'string' ? result.error : '') ||
      ''
    );

    if (
      code === 'weak_password' ||
      /known to be weak|easy to guess|weak password/i.test(raw)
    ) {
      return 'Choose a stronger password. Avoid common or easily guessed passwords.';
    }

    if (code === 'invalid_credentials' || /invalid login credentials/i.test(raw)) {
      return 'Email or password is incorrect. Try again or reset your password.';
    }

    if (
      code === 'over_email_send_rate_limit' ||
      code === 'email_rate_limit_exceeded' ||
      /rate limit/i.test(raw)
    ) {
      return 'Too many email requests were made. Wait a few minutes and try again.';
    }

    if (code === 'otp_expired' || /expired/i.test(raw)) {
      return 'This recovery link has expired. Request a new password reset email.';
    }

    return raw || fallback;
  }

  function supabaseSignOut(){
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_refresh_token');
    localStorage.removeItem('supabase_user_email');
  }

  function getAccessToken(){
    try { if (window._getAccessTokenImpl) return window._getAccessTokenImpl(); } catch(e){ void e; }
    return localStorage.getItem('supabase_access_token') || null;
  }

  function clearLocalFallbackOnAuth(){
    try { if (window.clearLocalFallbackOnAuth) return window.clearLocalFallbackOnAuth(); } catch(e){ void e; }
    const token = getAccessToken(); if (!token) return;
    const cur = localStorage.getItem('carSim_currentClassId') || null;
    if (cur && String(cur).startsWith('local-')){ localStorage.removeItem('carSim_currentClassId'); localStorage.removeItem('carSim_currentClassCode'); }
  }

  consumeAuthRedirect();

  // Expose
  window.supabaseSignIn = supabaseSignIn;
  window.supabaseSignUp = supabaseSignUp;
  window.supabaseRequestPasswordReset = supabaseRequestPasswordReset;
  window.supabaseUpdatePassword = supabaseUpdatePassword;
  window.supabaseSignOut = supabaseSignOut;
  window.getAccessToken = getAccessToken;
  window.getAuthErrorMessage = getAuthErrorMessage;
  window.consumeAuthRedirect = consumeAuthRedirect;
  window.clearLocalFallbackOnAuth = clearLocalFallbackOnAuth;
  window.showToast = showToast;
})();

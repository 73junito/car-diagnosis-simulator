const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple in-memory rate map: { ip => [timestamps] }
const rateMap = new Map();
const RATE_LIMIT = process.env.RATE_LIMIT ? Number(process.env.RATE_LIMIT) : 5; // submissions
const RATE_WINDOW_MS = process.env.RATE_WINDOW_MS ? Number(process.env.RATE_WINDOW_MS) : 60 * 60 * 1000; // 1 hour

function sanitize(s){ if(s===undefined || s===null) return ''; return String(s).trim(); }

function makeId(){ if(crypto && crypto.randomUUID) return crypto.randomUUID(); // node 14+
 // fallback simple uuid
 return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

async function sendEmail(record){
  const key = process.env.SENDGRID_API_KEY;
  const to = process.env.SENDGRID_TO;
  if(!key || !to) return false;
  const body = {
    personalizations: [{ to: [{ email: to }], subject: 'New Pilot Request: ' + (record.name || '') }],
    from: { email: process.env.SENDGRID_FROM || 'no-reply@example.com' },
    content: [{ type: 'text/plain', value: `New pilot request:\n\nName: ${record.name}\nEmail: ${record.email}\nDistrict: ${record.district}\nNotes: ${record.notes}\nSubmittedAt: ${record.submittedAt}` }]
  };
  try{
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body)
    });
    return res.ok;
  }catch(e){ return false; }
}

// Unified notification attempt: prefer Resend, fall back to SendGrid.
async function sendNotification(record){
  // Resend (https://resend.com/docs/api)
  const resendKey = process.env.RESEND_API_KEY;
  const resendTo = process.env.RESEND_TO;
  if(resendKey && resendTo){
    try{
      const toList = resendTo.split(',').map(s=>s.trim()).filter(Boolean);
      const body = {
        from: process.env.RESEND_FROM || 'no-reply@example.com',
        to: toList,
        subject: 'New Pilot Request: ' + (record.name || ''),
        text: `New pilot request:\n\nName: ${record.name}\nEmail: ${record.email}\nDistrict: ${record.district}\nNotes: ${record.notes}\nSubmittedAt: ${record.submittedAt}\n\nAdmin: ${process.env.SITE_URL || ''}/admin.html`
      };
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
        body: JSON.stringify(body)
      });
      if(r.ok) return { provider: 'resend', success: true };
      const t = await r.text().catch(()=>null);
      console.warn('resend send failed', r.status, t);
      return { provider: 'resend', success: false, errorMessage: t || `status:${r.status}` };
    }catch(e){ console.warn('resend error', e); return { provider: 'resend', success: false, errorMessage: String(e) }; }
  }

  // Fallback to SendGrid if configured
  if(process.env.SENDGRID_API_KEY && process.env.SENDGRID_TO){
    try{
      const ok = await sendEmail(record);
      return { provider: 'sendgrid', success: !!ok };
    }catch(e){ console.warn('sendgrid fallback error', e); return { provider: 'sendgrid', success: false, errorMessage: String(e) }; }
  }
  return { provider: 'none', success: false, errorMessage: 'no_provider_configured' };
}

module.exports = async (req, res) => {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if(req.method === 'OPTIONS') return res.status(204).end();

  if(req.method === 'GET'){
    // Support secure server-side fetches from Supabase when configured.
    // This handler supports two GET flows:
    // - /api/request-pilot => list pilot_requests (existing behavior)
    // - /api/request-pilot/audit => list notification_audit rows (new)
    const q = req.url && req.url.split('?')[1] || '';
    const params = new URLSearchParams(q);
    const pathname = (req.url || '').split('?')[0] || '';
    const isAudit = pathname.indexOf('/audit') !== -1 || pathname.endsWith('/audit');

    // Enforce admin token presence for read endpoints. If ADMIN_TOKEN
    // isn't configured, return a degraded-but-alive diagnostic response
    // rather than failing hard so the deployment can be health-checked.
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const expected = process.env.ADMIN_TOKEN ? `Bearer ${process.env.ADMIN_TOKEN}` : null;
    if(!expected){
      // Report current feature availability in a non-failing way.
      const storage = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) ? 'supabase' : (process.env.REQUESTS_FILE ? 'file' : 'disabled');
      const notifications = (process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY) ? 'enabled' : 'disabled';
      return res.status(200).json({ warning: 'missing_env', mode: 'degraded', storage, notifications });
    }
    if(authHeader !== expected) return res.status(401).json({ error: 'unauthorized' });

    // pagination params
    let limit = parseInt(params.get('limit') || '100', 10);
    let offset = parseInt(params.get('offset') || '0', 10);
    if(Number.isNaN(limit) || limit <= 0) limit = 100;
    if(Number.isNaN(offset) || offset < 0) offset = 0;
    const MAX_LIMIT = 1000;
    if(limit > MAX_LIMIT) limit = MAX_LIMIT;

    if(isAudit){
      // Audit listing
      const requestId = params.get('request_id') || null;
      if(process.env.SUPABASE_URL && process.env.SUPABASE_KEY){
        try{
          const sbUrlBase = process.env.SUPABASE_URL.replace(/\/+$/,'') + '/rest/v1/notification_audit';
          let url = sbUrlBase + `?select=request_id,provider,status,error_message,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`;
          if(requestId) url += `&request_id=eq.${encodeURIComponent(requestId)}`;
          const resp = await fetch(url, { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_KEY } });
          if(!resp.ok) return res.status(resp.status).json({ error: 'supabase_fetch_failed' });
          const rows = await resp.json();
          // total count
          let total = null;
          try{
            let countUrl = sbUrlBase + `?select=count`;
            if(requestId) countUrl += `&request_id=eq.${encodeURIComponent(requestId)}`;
            const cResp = await fetch(countUrl, { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_KEY } });
            if(cResp.ok){ const crow = await cResp.json(); if(Array.isArray(crow) && crow.length>0){ const val = crow[0].count || Object.values(crow[0])[0]; total = Number(val); } }
          }catch(e){ /* ignore count errors */ }
          const mapped = (rows || []).map(r => ({ request_id: r.request_id, provider: r.provider, status: r.status, error_message: r.error_message, created_at: r.created_at }));
          res.setHeader('Content-Type','application/json');
          return res.status(200).json({ items: mapped, limit, offset, total });
        }catch(e){ console.warn('supabase audit get error', e); return res.status(500).json({error:'supabase_error'}); }
      }

      // file fallback
      if(process.env.REQUESTS_FILE){
        try{
          const dataPath = path.join(process.cwd(),'data','notification_audit.json');
          if(fs.existsSync(dataPath)){
            let arr = JSON.parse(fs.readFileSync(dataPath,'utf8')||'[]');
            if(params.get('request_id')) arr = arr.filter(a=>String(a.request_id) === String(params.get('request_id')));
            const total = arr.length;
            const items = arr.slice(offset, offset + limit).map(a=>({ request_id: a.request_id, provider: a.provider, status: a.status, error_message: a.error_message, created_at: a.created_at }));
            return res.status(200).json({ items, limit, offset, total });
          }
          return res.status(200).json({ items: [], limit, offset, total: 0 });
        }catch(e){ return res.status(500).json({error:'read_failed'}); }
      }
      return res.status(501).json({error:'server_storage_disabled'});
    }

    // Non-audit: existing pilot_requests listing
    if(process.env.SUPABASE_URL && process.env.SUPABASE_KEY){
      try{
        const sbUrl = process.env.SUPABASE_URL.replace(/\/+$/,'') + '/rest/v1/pilot_requests';
        const url = sbUrl + `?select=id,name,email,district,submitted_at&order=submitted_at.desc&limit=${limit}&offset=${offset}`;
        const resp = await fetch(url, { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_KEY } });
        if(!resp.ok) return res.status(resp.status).json({ error: 'supabase_fetch_failed' });
        const rows = await resp.json();
        // attempt to fetch total count
        let total = null;
        try{
          const countUrl = sbUrl + `?select=count`;
          const cResp = await fetch(countUrl, { headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_KEY } });
          if(cResp.ok){
            const crow = await cResp.json();
            if(Array.isArray(crow) && crow.length>0){ const val = crow[0].count || Object.values(crow[0])[0]; total = Number(val); }
          }
        }catch(e){ /* ignore count errors */ }
        const mapped = (rows || []).map(r => ({ id: r.id, name: r.name, email: r.email, district: r.district, submittedAt: r.submitted_at }));
        res.setHeader('Content-Type','application/json');
        return res.status(200).json({ items: mapped, limit, offset, total });
      }catch(e){ console.warn('supabase get error', e); return res.status(500).json({error:'supabase_error'}); }
    }

    // Fallback: file-backed storage for demo/testing
    if(process.env.REQUESTS_FILE){
      try{
        const dataPath = path.join(process.cwd(),'data','requests.json');
        if(fs.existsSync(dataPath)){
          const body = fs.readFileSync(dataPath,'utf8');
          // return as items for compatibility
          const rows = JSON.parse(body || '[]');
          const total = rows.length;
          const items = rows.slice(offset, offset + limit).map(r => ({ id: r.id, name: r.name, email: r.email, district: r.district, submittedAt: r.submittedAt }));
          res.setHeader('Content-Type','application/json');
          return res.status(200).json({ items, limit, offset, total });
        }
        return res.status(200).json({ items: [], limit, offset, total: 0 });
      }catch(e){ return res.status(500).json({error:'read_failed'}); }
    }
    return res.status(501).json({error:'server_storage_disabled'});
  }

  // support POST /status for admin status updates
  const reqPath = (req.url || '').split('?')[0] || '';
  if(req.method === 'POST' && (reqPath.indexOf('/status') !== -1 || reqPath.endsWith('/status'))){
    // admin-only
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const expected = process.env.ADMIN_TOKEN ? `Bearer ${process.env.ADMIN_TOKEN}` : null;
    if(!expected) return res.status(501).json({ error: 'admin_not_configured' });
    if(authHeader !== expected) return res.status(401).json({ error: 'unauthorized' });

    // parse small body
    const MAX_BODY = 10 * 1024; // 10KB
    let rawBody = '';
    if(req.body && Object.keys(req.body).length){ rawBody = JSON.stringify(req.body); }
    else {
      rawBody = await new Promise((resolve, reject) => {
        let s = '';
        req.on('data', chunk => { s += chunk; if(s.length > MAX_BODY){ reject(new Error('body_too_large')); req.destroy(); } });
        req.on('end', () => resolve(s || '{}'));
        req.on('error', reject);
      });
    }
    let body = {};
    try{ body = rawBody ? JSON.parse(rawBody) : {}; }catch(e){ return res.status(400).json({ error: 'invalid_json' }); }
    const id = sanitize(body.id || '');
    const status = sanitize(body.status || '').toLowerCase();
    const allowed = new Set(['new','contacted','qualified','closed']);
    if(!id) return res.status(400).json({ error: 'missing_id' });
    if(!allowed.has(status)) return res.status(400).json({ error: 'invalid_status' });

    // Update Supabase if configured
    if(process.env.SUPABASE_URL && process.env.SUPABASE_KEY){
      try{
        const sbUrl = process.env.SUPABASE_URL.replace(/\/+$/,'') + `/rest/v1/pilot_requests?id=eq.${encodeURIComponent(id)}`;
        const resp = await fetch(sbUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': 'Bearer ' + process.env.SUPABASE_KEY,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ status })
        });
        if(!resp.ok){ const t = await resp.text().catch(()=>null); console.warn('supabase status update failed', resp.status, t); return res.status(500).json({ error: 'supabase_update_failed' }); }
        return res.status(200).json({ success: true });
      }catch(e){ console.warn('supabase status error', e); return res.status(500).json({ error: 'supabase_error' }); }
    }

    // File fallback
    if(process.env.REQUESTS_FILE){
      try{
        const dataPath = path.join(process.cwd(),'data','requests.json');
        let arr = [];
        if(fs.existsSync(dataPath)){
          try{ arr = JSON.parse(fs.readFileSync(dataPath,'utf8')||'[]'); }catch(e){ arr = []; }
        }
        let found = false;
        arr = arr.map(r => { if(String(r.id) === String(id)){ r.status = status; found = true; } return r; });
        if(found) fs.writeFileSync(dataPath, JSON.stringify(arr, null, 2), 'utf8');
        return res.status(200).json({ success: !!found });
      }catch(e){ console.warn('file status update failed', e); return res.status(500).json({ error: 'file_update_failed' }); }
    }

    return res.status(501).json({ error: 'server_storage_disabled' });
  }

  if(req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});

  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if(Array.isArray(ip)) ip = ip[0];

  try{
    // parse body with a size limit to avoid abuse (10kb)
    const MAX_BODY = 10 * 1024; // 10KB
    let rawBody = '';
    if(req.body && Object.keys(req.body).length){
      rawBody = JSON.stringify(req.body);
    } else {
      rawBody = await new Promise((resolve, reject) => {
        let s = '';
        req.on('data', chunk => {
          s += chunk;
          if(s.length > MAX_BODY) {
            reject(new Error('body_too_large'));
            req.destroy();
          }
        });
        req.on('end', () => resolve(s || '{}'));
        req.on('error', reject);
      });
    }
    const body = rawBody ? JSON.parse(rawBody) : {};

    // Honeypot: field 'hp' should be empty
    if(body.hp) return res.status(400).json({error:'spam_detected'});

    // Rate limiting
    const now = Date.now();
    const arr = rateMap.get(ip) || [];
    // prune old
    const recent = arr.filter(ts => now - ts < RATE_WINDOW_MS);
    if(recent.length >= RATE_LIMIT) return res.status(429).json({error:'rate_limited'});
    recent.push(now);
    rateMap.set(ip, recent);

    // Validate (authoritative server-side checks)
    const name = sanitize(body.name || '');
    const email = sanitize(body.email || '');
    const district = sanitize(body.district || '');
    const notes = sanitize(body.notes || '');

    // Required
    if(!name) return res.status(400).json({error:'missing_name'});
    if(!email) return res.status(400).json({error:'missing_email'});

    // Max lengths
    const MAX_NAME = 100;
    const MAX_EMAIL = 254;
    const MAX_DISTRICT = 100;
    const MAX_NOTES = 1000;
    if(name.length > MAX_NAME) return res.status(400).json({error:'name_too_long'});
    if(email.length > MAX_EMAIL) return res.status(400).json({error:'email_too_long'});
    if(district.length > MAX_DISTRICT) return res.status(400).json({error:'district_too_long'});
    if(notes.length > MAX_NOTES) return res.status(400).json({error:'notes_too_long'});

    // Email format
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRe.test(email)) return res.status(400).json({error:'invalid_email'});

    const rec = { id: makeId(), name, email, district, notes, submittedAt: new Date().toISOString() };

    // Prefer durable Supabase storage when configured
    let storedToSupabase = false;
    if(process.env.SUPABASE_URL && process.env.SUPABASE_KEY){
      try{
        const sbUrl = (process.env.SUPABASE_URL.replace(/\/+$/,'')) + '/rest/v1/pilot_requests';
        const insertBody = Object.assign({}, rec);
        // Supabase expects submitted_at column name if using snake_case
        insertBody.submitted_at = rec.submittedAt;
        delete insertBody.submittedAt;
        const resp = await fetch(sbUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': 'Bearer ' + process.env.SUPABASE_KEY,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify([insertBody])
        });
        if(resp.ok){ storedToSupabase = true; }
        else { const t = await resp.text(); console.warn('supabase insert failed', resp.status, t); }
      }catch(e){ console.warn('supabase error', e); }
    }

    // Optional file-backed storage as fallback (useful for demos)
    if(!storedToSupabase && process.env.REQUESTS_FILE){
      try{
        const dataDir = path.join(process.cwd(),'data');
        if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive:true });
        const dataPath = path.join(dataDir,'requests.json');
        let arr = [];
        if(fs.existsSync(dataPath)){
          try{ arr = JSON.parse(fs.readFileSync(dataPath,'utf8')||'[]'); }catch(e){ arr = []; }
        }
        arr.push(rec);
        fs.writeFileSync(dataPath, JSON.stringify(arr, null, 2), 'utf8');
      }catch(e){ /* ignore write errors */ }
    }

    // Attempt notification and write audit log (await so audit is recorded reliably).
    let notifResult = { provider: 'none', success: false };
    try{
      notifResult = await sendNotification(rec);
    }catch(e){ notifResult = { provider: 'unknown', success: false, errorMessage: String(e) }; }

    // Record notification audit to Supabase if available, else file fallback (best-effort, do not fail submission)
    try{
      const audit = {
        request_id: rec.id,
        provider: notifResult.provider || 'unknown',
        status: notifResult.success ? 'sent' : 'failed',
        error_message: notifResult.errorMessage || null
      };
      if(process.env.SUPABASE_URL && process.env.SUPABASE_KEY){
        try{
          const sbAuditUrl = process.env.SUPABASE_URL.replace(/\/+$/,'') + '/rest/v1/notification_audit';
          await fetch(sbAuditUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_KEY,
              'Authorization': 'Bearer ' + process.env.SUPABASE_KEY,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify([audit])
          });
        }catch(e){ console.warn('audit insert failed', e); }
      }else if(process.env.REQUESTS_FILE){
        try{
          const dataDir = path.join(process.cwd(),'data');
          if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive:true });
          const auditPath = path.join(dataDir,'notification_audit.json');
          let arr = [];
          if(fs.existsSync(auditPath)){
            try{ arr = JSON.parse(fs.readFileSync(auditPath,'utf8')||'[]'); }catch(e){ arr = []; }
          }
          arr.push(Object.assign({ id: makeId(), created_at: new Date().toISOString() }, audit));
          fs.writeFileSync(auditPath, JSON.stringify(arr, null, 2), 'utf8');
        }catch(e){ console.warn('audit file write failed', e); }
      }
    }catch(e){ console.warn('audit error', e); }

    return res.status(200).json({ok:true, id: rec.id});
  }catch(e){
    if(e && e.message === 'body_too_large') return res.status(413).json({error:'body_too_large'});
    return res.status(500).json({error:'server_error'});
  }
};

(function(){
  const DEBOUNCE_MS = 300;
  let debounceTimer = null;
  let inflight = null;

  function $id(id){ return document.getElementById(id) }

  function sanitizePayload(payload){
    try{
      const json = typeof payload === 'string' ? JSON.parse(payload) : payload;
      // Keep first-level keys only and truncate long values
      if (json && typeof json === 'object'){
        const out = {};
        for (const k of Object.keys(json)){
          let v = json[k];
          if (typeof v === 'object') v = '[object]';
          else if (typeof v === 'string' && v.length > 200) v = v.slice(0,200)+"…";
          out[k] = v;
        }
        return JSON.stringify(out);
      }
      return JSON.stringify(json);
    }catch(e){
      // fallback to safe string
      try{ return String(payload) }catch(err){ return '—' }
    }
  }

  function fmtTimestamp(ts){
    if (!ts) return '—';
    const n = Date.parse(ts);
    if (Number.isFinite(n)) return new Date(n).toISOString();
    return String(ts);
  }

  async function fetchEvents(sessionId, limit){
    const q = new URLSearchParams();
    if (sessionId) q.set('session', sessionId);
    if (limit) q.set('limit', String(limit));
    const path = '/api/telemetry/history?'+q.toString();
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Fetch failed: '+res.status);
    return res.json();
  }

  function renderRows(events){
    const tbody = document.querySelector('#session-history-table tbody');
    tbody.innerHTML = '';
    if (!Array.isArray(events) || events.length === 0) return;
    // newest-first expected; ensure ordering
    const frag = document.createDocumentFragment();
    for (const ev of events){
      const tr = document.createElement('tr');
      const ts = document.createElement('td'); ts.textContent = fmtTimestamp(ev.created_at || ev.timestamp || ev.ts || ev.time);
      const type = document.createElement('td'); type.textContent = ev.type || ev.event_type || '—';
      const session = document.createElement('td'); session.textContent = ev.session_id || ev.session || '—';
      const payload = document.createElement('td'); payload.textContent = sanitizePayload(ev.payload ?? ev.data ?? ev.body ?? ev);
      tr.appendChild(ts); tr.appendChild(type); tr.appendChild(session); tr.appendChild(payload);
      frag.appendChild(tr);
    }
    // cap UI rows for safety
    const MAX_RENDER = 500;
    const children = Array.from(frag.children).slice(0, MAX_RENDER);
    const safeFrag = document.createDocumentFragment();
    children.forEach(c=>safeFrag.appendChild(c));
    tbody.appendChild(safeFrag);
  }

  function setLoading(on){
    $id('loading').hidden = !on;
    const session = $id('session-filter').value.trim() || null;
    const limit = Number($id('limit-select').value) || 50;

    setError(null);
    setEmpty(false);
    setLoading(true);

    try{
      inflight = fetchEvents(session, limit);
      const data = await inflight;
      inflight = null;
      setLoading(false);
      if (!data || data.ok === false){
        setError('No data available');
        renderRows([]);
        setEmpty(true);
        return;
      }
      const rows = Array.isArray(data.data) ? data.data : [];
      if (!rows.length){ renderRows([]); setEmpty(true); return }
      // ensure newest-first
      rows.sort((a,b)=>{
        const ta = Date.parse(a.created_at||a.timestamp||a.ts||a.time);
        const tb = Date.parse(b.created_at||b.timestamp||b.ts||b.time);
        return (isNaN(tb)?0:tb) - (isNaN(ta)?0:ta);
      });
      renderRows(rows);
    }catch(err){
      setLoading(false);
      setError('Error fetching events');
      renderRows([]);
      setEmpty(true);
      console.warn('session-history fetch failed', err);
    }
  }

  function scheduleFetch(){
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(()=>{ doFetchAndRender() }, DEBOUNCE_MS);
  }

  // buildExportUrl is available at module scope so tests can import it
  function buildExportUrl(kind){
    const session = (typeof document !== 'undefined' && $id('session-filter')) ? $id('session-filter').value.trim() : '';
    const limit = (typeof document !== 'undefined' && $id('limit-select')) ? Number($id('limit-select').value) || 50 : 50;
    const q = new URLSearchParams();
    if (session) q.set('session', session);
    if (limit) q.set('limit', String(limit));
    const ext = kind === 'csv' ? 'csv' : 'json';
    return '/api/telemetry/export.' + ext + (q.toString() ? ('?' + q.toString()) : '');
  }

  function initSessionHistory(){
    try{
      const sessionInput = $id('session-filter');
      const limitSelect = $id('limit-select');
      sessionInput.addEventListener('input', scheduleFetch);
      limitSelect.addEventListener('change', scheduleFetch);
      // Export buttons
      const exportJson = $id('export-json-btn');
      const exportCsv = $id('export-csv-btn');
      const exportStatus = $id('export-status');
      function setExportLoading(on){
        if (exportJson) exportJson.disabled = on;
        if (exportCsv) exportCsv.disabled = on;
        if (exportStatus) exportStatus.textContent = on ? 'Preparing download…' : '';
      }

      // buildExportUrl is defined at module scope

      function triggerDownload(url){
        // create temporary anchor and click to trigger browser download/navigation
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        try{ a.click(); }catch(e){ window.location.href = url }
        document.body.removeChild(a);
      }

      
      if (exportJson) exportJson.addEventListener('click', async ()=>{
        setExportLoading(true);
        const url = buildExportUrl('json');
        triggerDownload(url);
        setExportLoading(false);
      });
      if (exportCsv) exportCsv.addEventListener('click', async ()=>{
        setExportLoading(true);
        const url = buildExportUrl('csv');
        triggerDownload(url);
        setExportLoading(false);
      });
      // initial fetch
      scheduleFetch();
    }catch(e){ /* page elements missing — ignore */ }
  }

  if (typeof module !== 'undefined' && module.exports){
    module.exports = { initSessionHistory, sanitizePayload, fmtTimestamp, buildExportUrl };
  }

  document.addEventListener('DOMContentLoaded', initSessionHistory);
})();

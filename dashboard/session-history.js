(function(){
  const DEBOUNCE_MS = 300;
  let debounceTimer = null;
  let _inflight = null;

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

  async function fetchEvents(classId, sessionId, limit){
    if (!classId) return { ok: true, data: [] };
    const q = new URLSearchParams();
    q.set('classId', classId);
    if (sessionId) q.set('session', sessionId);
    if (limit) q.set('limit', String(limit));
    return window.apiGet('/api/telemetry/history?' + q.toString());
  }

  function renderRows(events){
    const tbody = document.querySelector('#session-history-table tbody');
    if (tbody) while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
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
  }

  function setError(msg){
    const el = $id('error');
    if (!msg){ el.hidden = true; el.textContent = ''; return }
    el.hidden = false; el.textContent = msg;
  }
  function setEmpty(on){ $id('empty').hidden = !on }

  function doFetchAndRender(){
    const classId = (typeof document !== 'undefined' && $id('history-class')) ? $id('history-class').value : '';
    const session = (typeof document !== 'undefined' && $id('session-filter')) ? $id('session-filter').value.trim() : null;
    const limit = (typeof document !== 'undefined' && $id('limit-select')) ? Number($id('limit-select').value) || 50 : 50;

    if (!classId){
      setLoading(false);
      setError(null);
      setEmpty(true);
      renderRows([]);
      return;
    }

    setError(null);
    setEmpty(false);
    setLoading(true);

    _inflight = fetchEvents(classId, session, limit)
      .then((data) => {
        _inflight = null;
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
      })
      .catch((err) => {
        _inflight = null;
        setLoading(false);
        if (err?.status === 401 || err?.status === 403) {
          window.location.replace('/sign-in/instructor/');
          return;
        }
        setError('Error fetching events');
        renderRows([]);
        setEmpty(true);
        console.warn('session-history fetch failed', err);
      });
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

  async function initSessionHistory(){
    try{
      const token = window.getAccessToken ? window.getAccessToken() : null;
      if (!token){
        window.location.replace('/sign-in/instructor/');
        return;
      }

      const classSelect = $id('history-class');
      const sessionInput = $id('session-filter');
      const limitSelect = $id('limit-select');
      const exportStatus = $id('export-status');

      sessionInput.addEventListener('input', scheduleFetch);
      limitSelect.addEventListener('change', scheduleFetch);
      classSelect.addEventListener('change', () => {
        sessionInput.disabled = !classSelect.value;
        scheduleFetch();
      });

      if (exportStatus) exportStatus.textContent = 'Secure class-scoped export is pending migration.';

      try {
        const result = await window.apiGet('/api/classes');
        const classes = Array.isArray(result?.classes) ? result.classes : [];
        classSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = classes.length ? 'Select a class' : 'No classes available';
        classSelect.appendChild(placeholder);

        for (const cls of classes){
          const option = document.createElement('option');
          option.value = cls.id;
          option.textContent = cls.name;
          classSelect.appendChild(option);
        }

        if (classes.length === 1){
          classSelect.value = classes[0].id;
          sessionInput.disabled = false;
          scheduleFetch();
        } else {
          setEmpty(true);
        }
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) {
          window.location.replace('/sign-in/instructor/');
          return;
        }
        setError('Unable to load owned classes');
      }
    }catch(e){ void e; }
  }

  if (typeof module !== 'undefined' && module.exports){
    module.exports = { initSessionHistory, sanitizePayload, fmtTimestamp, buildExportUrl };
  }

  // mark tracked promise variable as intentionally unused for lint
  void _inflight;

  document.addEventListener('DOMContentLoaded', initSessionHistory);
})();

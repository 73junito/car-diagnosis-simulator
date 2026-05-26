/**
 * Jest spec for dashboard/session-history.js
 */

// minimal DOM fixture created programmatically; no file IO required

beforeEach(()=>{
  // construct minimal DOM fixture safely (avoid innerHTML)
  if (!document.body) document.documentElement.appendChild(document.createElement('body'));
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  const main = document.createElement('main'); main.className = 'container';
  const h1 = document.createElement('h1'); h1.textContent = 'Session History';
  const controls = document.createElement('section'); controls.id = 'controls';
  const label = document.createElement('label'); label.textContent = 'Session filter: ';
  const input = document.createElement('input'); input.id = 'session-filter'; input.placeholder = 'Enter session id';
  label.appendChild(input);
  const limitLabel = document.createElement('label'); limitLabel.textContent = 'Limit: ';
  const select = document.createElement('select'); select.id = 'limit-select';
  ['10','25','50','100'].forEach((v)=>{ const opt = document.createElement('option'); opt.value = v; opt.textContent = v; if (v==='50') opt.selected = true; select.appendChild(opt); });
  limitLabel.appendChild(select);
  const exportControls = document.createElement('div'); exportControls.id = 'export-controls';
  const jsonBtn = document.createElement('button'); jsonBtn.id = 'export-json-btn'; jsonBtn.textContent = 'Export JSON';
  const csvBtn = document.createElement('button'); csvBtn.id = 'export-csv-btn'; csvBtn.textContent = 'Export CSV';
  const exportStatus = document.createElement('span'); exportStatus.id = 'export-status'; exportStatus.setAttribute('aria-live','polite');
  exportControls.appendChild(jsonBtn); exportControls.appendChild(csvBtn); exportControls.appendChild(exportStatus);
  controls.appendChild(label); controls.appendChild(limitLabel); controls.appendChild(exportControls);

  const status = document.createElement('section'); status.id = 'status';
  const loading = document.createElement('div'); loading.id = 'loading'; loading.setAttribute('aria-live','polite'); loading.hidden = true; loading.textContent = 'Loading…';
  const error = document.createElement('div'); error.id = 'error'; error.role = 'alert'; error.hidden = true;
  const empty = document.createElement('div'); empty.id = 'empty'; empty.hidden = true; empty.textContent = 'No events found.';
  status.appendChild(loading); status.appendChild(error); status.appendChild(empty);

  const section = document.createElement('section');
  const table = document.createElement('table'); table.id = 'session-history-table'; table.className = 'tm-table';
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  ['Timestamp','Type','Session','Payload'].forEach((txt)=>{ const th = document.createElement('th'); th.textContent = txt; tr.appendChild(th); });
  thead.appendChild(tr);
  const tbody = document.createElement('tbody');
  table.appendChild(thead); table.appendChild(tbody);
  section.appendChild(table);

  main.appendChild(h1); main.appendChild(controls); main.appendChild(status); main.appendChild(section);
  document.body.appendChild(main);
  jest.resetModules();
});

afterEach(()=>{ while (document.body.firstChild) document.body.removeChild(document.body.firstChild); jest.clearAllMocks(); });

function tick(ms){ return new Promise(r=>setTimeout(r, ms)); }

describe('Session history UI', ()=>{
  test('shows loading state then renders rows', async ()=>{
    const mockData = { ok:true, data: [ { id:'1', created_at: '2020-01-02T00:00:00Z', type:'evt', session_id:'s1', payload:{a:1} } ] };
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: ()=>Promise.resolve(mockData) });

    const { initSessionHistory } = require('../dashboard/session-history.js');
    initSessionHistory();

    // allow debounce
    await tick(350);

    expect(document.getElementById('loading').hidden).toBe(true);
    const rows = document.querySelectorAll('#session-history-table tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].children[2].textContent).toBe('s1');
  });

  test('empty state when no events', async ()=>{
    const mockData = { ok:true, data: [] };
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: ()=>Promise.resolve(mockData) });
    const { initSessionHistory } = require('../dashboard/session-history.js');
    initSessionHistory();
    await tick(350);
    expect(document.getElementById('empty').hidden).toBe(false);
    expect(document.querySelectorAll('#session-history-table tbody tr').length).toBe(0);
  });

  test('error state when API returns ok:false', async ()=>{
    const mockData = { ok:false };
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: ()=>Promise.resolve(mockData) });
    const { initSessionHistory } = require('../dashboard/session-history.js');
    initSessionHistory();
    await tick(350);
    expect(document.getElementById('error').hidden).toBe(false);
    expect(document.getElementById('error').textContent).toMatch(/no data/i);
  });

  test('debounces session input ~300ms', async ()=>{
    jest.useFakeTimers();
    const mockData = { ok:true, data: [ { id:'1', created_at: '2020-01-02T00:00:00Z', type:'evt', session_id:'s1', payload:{a:1} } ] };
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: ()=>Promise.resolve(mockData) });
    const { initSessionHistory } = require('../dashboard/session-history.js');
    initSessionHistory();

    const input = document.getElementById('session-filter');
    input.value = 's'; input.dispatchEvent(new Event('input'));
    input.value = 's1'; input.dispatchEvent(new Event('input'));

    // advance less than debounce
    jest.advanceTimersByTime(200);
    expect(global.fetch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    // now debounce should fire
    expect(global.fetch).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('export buttons and URLs include session and limit', async ()=>{
    const mockData = { ok:true, data: [] };
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: ()=>Promise.resolve(mockData) });
    const { initSessionHistory, buildExportUrl } = require('../dashboard/session-history.js');
    initSessionHistory();
    // default limit is 50
    document.getElementById('session-filter').value = 'session-42';
    document.getElementById('limit-select').value = '25';

    const jsonUrl = buildExportUrl('json');
    const csvUrl = buildExportUrl('csv');

    expect(document.getElementById('export-json-btn')).not.toBeNull();
    expect(document.getElementById('export-csv-btn')).not.toBeNull();
    expect(jsonUrl).toMatch(/\/api\/telemetry\/export\.json/);
    expect(csvUrl).toMatch(/\/api\/telemetry\/export\.csv/);
    expect(jsonUrl).toMatch(/session=session-42/);
    expect(csvUrl).toMatch(/limit=25/);
  });

  test('empty session filter omits session param', async ()=>{
    const mockData = { ok:true, data: [] };
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: ()=>Promise.resolve(mockData) });
    const { initSessionHistory, buildExportUrl } = require('../dashboard/session-history.js');
    initSessionHistory();
    document.getElementById('session-filter').value = '';
    document.getElementById('limit-select').value = '10';
    const url = buildExportUrl('json');
    expect(url).toMatch(/limit=10/);
    expect(url).not.toMatch(/session=/);
  });

});

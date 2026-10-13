/**
 * Jest spec for dashboard/session-history.js
 */

beforeEach(()=>{
  if (!document.body) document.documentElement.appendChild(document.createElement('body'));
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);

  const main = document.createElement('main'); main.className = 'container';
  const h1 = document.createElement('h1'); h1.textContent = 'Session History';
  const controls = document.createElement('section'); controls.id = 'controls';

  const classLabel = document.createElement('label'); classLabel.textContent = 'Class: ';
  const classSelect = document.createElement('select'); classSelect.id = 'history-class';
  const loadingClass = document.createElement('option'); loadingClass.value = ''; loadingClass.textContent = 'Loading classes…';
  classSelect.appendChild(loadingClass);
  classLabel.appendChild(classSelect);

  const label = document.createElement('label'); label.textContent = 'Session filter: ';
  const input = document.createElement('input'); input.id = 'session-filter'; input.placeholder = 'Enter session id'; input.disabled = true;
  label.appendChild(input);

  const limitLabel = document.createElement('label'); limitLabel.textContent = 'Limit: ';
  const select = document.createElement('select'); select.id = 'limit-select';
  ['10','25','50','100'].forEach((v)=>{ const opt = document.createElement('option'); opt.value = v; opt.textContent = v; if (v==='50') opt.selected = true; select.appendChild(opt); });
  limitLabel.appendChild(select);

  const exportControls = document.createElement('div'); exportControls.id = 'export-controls';
  const jsonBtn = document.createElement('button'); jsonBtn.id = 'export-json-btn'; jsonBtn.textContent = 'Export JSON'; jsonBtn.disabled = true;
  const csvBtn = document.createElement('button'); csvBtn.id = 'export-csv-btn'; csvBtn.textContent = 'Export CSV'; csvBtn.disabled = true;
  const exportStatus = document.createElement('span'); exportStatus.id = 'export-status'; exportStatus.setAttribute('aria-live','polite');
  exportControls.appendChild(jsonBtn); exportControls.appendChild(csvBtn); exportControls.appendChild(exportStatus);
  controls.appendChild(classLabel); controls.appendChild(label); controls.appendChild(limitLabel); controls.appendChild(exportControls);

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

  window.getAccessToken = jest.fn(()=>'test-token');
  window.apiGet = jest.fn();
  jest.resetModules();
});

afterEach(()=>{
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  delete window.getAccessToken;
  delete window.apiGet;
  jest.clearAllMocks();
});

function tick(ms){ return new Promise(r=>setTimeout(r, ms)); }

function mockOwnedClassAndHistory(historyResult){
  window.apiGet.mockImplementation((path)=>{
    if (path === '/api/classes') {
      return Promise.resolve({ classes: [{ id: 'class-1', name: 'AUT 101' }] });
    }
    if (path.startsWith('/api/telemetry/history?')) {
      return Promise.resolve(historyResult);
    }
    return Promise.reject(new Error('Unexpected API path: ' + path));
  });
}

describe('Session history UI', ()=>{
  test('shows loading state then renders class-scoped rows', async ()=>{
    const mockData = { ok:true, data: [ { created_at: '2020-01-02T00:00:00Z', event_type:'evt', session_id:'s1', payload:{a:1} } ] };
    mockOwnedClassAndHistory(mockData);

    const { initSessionHistory } = require('../dashboard/session-history.js');
    await initSessionHistory();
    await tick(350);

    expect(document.getElementById('history-class').value).toBe('class-1');
    expect(document.getElementById('session-filter').disabled).toBe(false);
    expect(document.getElementById('loading').hidden).toBe(true);
    const rows = document.querySelectorAll('#session-history-table tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].children[2].textContent).toBe('s1');

    const historyCall = window.apiGet.mock.calls.map(([path])=>path).find((path)=>path.startsWith('/api/telemetry/history?'));
    expect(historyCall).toMatch(/classId=class-1/);
    expect(historyCall).toMatch(/limit=50/);
  });

  test('empty state when owned class has no events', async ()=>{
    mockOwnedClassAndHistory({ ok:true, data: [] });
    const { initSessionHistory } = require('../dashboard/session-history.js');
    await initSessionHistory();
    await tick(350);

    expect(document.getElementById('empty').hidden).toBe(false);
    expect(document.querySelectorAll('#session-history-table tbody tr').length).toBe(0);
  });

  test('error state when API returns ok:false', async ()=>{
    mockOwnedClassAndHistory({ ok:false });
    const { initSessionHistory } = require('../dashboard/session-history.js');
    await initSessionHistory();
    await tick(350);

    expect(document.getElementById('error').hidden).toBe(false);
    expect(document.getElementById('error').textContent).toMatch(/no data/i);
  });

  test('debounces session input and keeps class scope', async ()=>{
    jest.useFakeTimers();
    mockOwnedClassAndHistory({ ok:true, data: [] });
    const { initSessionHistory } = require('../dashboard/session-history.js');
    await initSessionHistory();

    // Clear the class-load call and pending initial history debounce.
    if (jest.getTimerCount()) jest.runOnlyPendingTimers();
    await Promise.resolve();
    window.apiGet.mockClear();

    // Preserve the same implementation after clearing call history.
    mockOwnedClassAndHistory({ ok:true, data: [] });

    const input = document.getElementById('session-filter');
    input.value = 's'; input.dispatchEvent(new Event('input'));
    input.value = 's1'; input.dispatchEvent(new Event('input'));

    jest.advanceTimersByTime(200);
    expect(window.apiGet).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    await Promise.resolve();

    expect(window.apiGet).toHaveBeenCalledTimes(1);
    const path = window.apiGet.mock.calls[0][0];
    expect(path).toMatch(/classId=class-1/);
    expect(path).toMatch(/session=s1/);
    jest.useRealTimers();
  });

  test('secure export buttons enable for owned class and URL builder preserves class/session/limit', async ()=>{
    mockOwnedClassAndHistory({ ok:true, data: [] });
    const { initSessionHistory, buildExportUrl } = require('../dashboard/session-history.js');
    await initSessionHistory();

    document.getElementById('session-filter').value = 'session-42';
    document.getElementById('limit-select').value = '25';

    const jsonUrl = buildExportUrl('json');
    const csvUrl = buildExportUrl('csv');

    expect(document.getElementById('export-json-btn').disabled).toBe(false);
    expect(document.getElementById('export-csv-btn').disabled).toBe(false);
    expect(jsonUrl).toMatch(/\/api\/telemetry\/export\.json/);
    expect(csvUrl).toMatch(/\/api\/telemetry\/export\.csv/);
    expect(jsonUrl).toMatch(/classId=class-1/);
    expect(jsonUrl).toMatch(/session=session-42/);
    expect(csvUrl).toMatch(/classId=class-1/);
    expect(csvUrl).toMatch(/limit=25/);
  });

  test('empty session filter omits session param', async ()=>{
    mockOwnedClassAndHistory({ ok:true, data: [] });
    const { initSessionHistory, buildExportUrl } = require('../dashboard/session-history.js');
    await initSessionHistory();

    document.getElementById('session-filter').value = '';
    document.getElementById('limit-select').value = '10';
    const url = buildExportUrl('json');
    expect(url).toMatch(/limit=10/);
    expect(url).not.toMatch(/session=/);
  });
});

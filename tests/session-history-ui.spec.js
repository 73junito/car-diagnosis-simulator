/**
 * Jest spec for dashboard/session-history.js
 */

const fs = require('fs');
const path = require('path');

beforeEach(()=>{
  // load HTML fixture
  const html = fs.readFileSync(path.join(__dirname,'..','dashboard','session-history.html'),'utf8');
  document.documentElement.innerHTML = html;
  jest.resetModules();
});

afterEach(()=>{ document.body.innerHTML = ''; jest.clearAllMocks(); });

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

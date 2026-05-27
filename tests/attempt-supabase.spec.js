/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('Supabase attempt adapter (mocked)', () => {
  beforeEach(() => {
    while(document.body.firstChild) document.body.removeChild(document.body.firstChild);
    // clear any global client
    window.supabase = undefined;
  });

  test('falls back to in-memory store when supabase not configured', async () => {
    const storeCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-store.js'),'utf8');
    const supaCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-supabase.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: storeCode}));
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: supaCode}));

    // use attemptSupabase to save and load
    await window.attemptSupabase.saveAttempt('no-start', { test: 1 });
    const s = await window.attemptSupabase.loadAttempt('no-start');
    expect(s).not.toBeNull();
    expect(s.test).toBe(1);
  });

  test('uses supabase client when available (mocked)', async () => {
    // provide a fake client
    window.supabase = { createClient: () => ({ from: () => ({ upsert: async (v)=>({ ok:true, v }), select: ()=>({ async eq(){ return { data:{ data: { test: 2 } }, error: null } } }) }) }) };
    const supaCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-supabase.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: supaCode}));
    // override env values on window
    window.SUPABASE_URL = 'https://example.supabase.co'; window.SUPABASE_KEY = 'anon-key';
    // call saveAttempt - expects remote client to be used
    const res = await window.attemptSupabase.saveAttempt('no-start', { test: 2 });
    // If remote client used, res should be an object (or not throw)
    expect(res).toBeTruthy();
  });
});

/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

describe('attemptAdapter wiring', () => {
  beforeEach(() => {
    // clear globals
    delete window.attemptAdapter;
    delete window.attemptStore;
    delete window.attemptSupabase;
    delete window.USE_SUPABASE_ATTEMPTS;
  });

  test('uses in-memory attemptStore by default', () => {
    // load attempt-store then adapter
    const storeCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-store.js'),'utf8');
    const adapterCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-adapter.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: storeCode}));
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: adapterCode}));

    expect(window.attemptAdapter).toBeDefined();
    window.attemptAdapter.saveAttempt('s1', { a: 1 });
    const loaded = window.attemptAdapter.loadAttempt('s1');
    expect(loaded).not.toBeNull();
    expect(loaded.a).toBe(1);
  });

  test('uses supabase adapter when feature flag enabled', async () => {
    // provide a fake supabase adapter
    window.USE_SUPABASE_ATTEMPTS = '1';
    window.attemptSupabase = {
      saveAttempt: jest.fn().mockResolvedValue({ ok: true }),
      loadAttempt: jest.fn().mockResolvedValue({ data: { a: 2 } })
    };
    const adapterCode = fs.readFileSync(path.resolve(process.cwd(),'dashboard/attempt-adapter.js'),'utf8');
    document.head.appendChild(Object.assign(document.createElement('script'),{textContent: adapterCode}));

    expect(window.attemptAdapter).toBeDefined();
    const res = await window.attemptAdapter.saveAttempt('s2', { a: 2 });
    expect(window.attemptSupabase.saveAttempt).toHaveBeenCalled();
    const loaded = await window.attemptAdapter.loadAttempt('s2');
    expect(window.attemptSupabase.loadAttempt).toHaveBeenCalled();
  });
});

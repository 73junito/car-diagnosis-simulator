const { test, expect } = require('@playwright/test');

// Allowed 404 patterns (analytics endpoints intentionally excluded)
const allowed404Patterns = ['/analytics', '/telemetry', '/api/analytics', '/api/telemetry'];

test.describe('Student dashboard filtering', ()=>{
  test('search filter reduces results and matches registry', async ({ browser })=>{
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => { if(msg.type() === 'error') consoleErrors.push(msg.text()); });
    const badResponses = [];
    page.on('response', resp => { if(resp.status() === 404){ const url = resp.url(); if(!allowed404Patterns.some(p=>url.includes(p))) badResponses.push({url, status: resp.status()}); } });

    const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3003';
    await page.goto(`${BASE_URL}/dashboard/student`);
    await page.waitForLoadState('networkidle');

    // Ensure a clean UI state
    await page.evaluate(()=>{ try{ localStorage.removeItem('student_progress'); localStorage.removeItem('last_scenario'); }catch(e){} });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // fill the search input and assert reduced results
    await page.waitForSelector('#scenarioGrid');
    const search = await page.$('#searchInput');
    // register next-render waiter, then trigger input so we await the following render
    const waitForNextRender = page.evaluate(() => new Promise(resolve => window.addEventListener('grid:rendered', resolve, { once: true })));
    await search.fill('no-crank');
    const afterFill = await page.evaluate(()=> (document.getElementById('searchInput')||{}).value );
    console.log('afterFill value', afterFill);
    await page.dispatchEvent('#searchInput','input');
    const afterDispatch = await page.evaluate(()=> (document.getElementById('searchInput')||{}).value );
    console.log('afterDispatch value', afterDispatch);
    await waitForNextRender;

    const filtered = await page.$$('#scenarioGrid .sd-card');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(17);

    // verify DOM ids match registry-filtered ids
    const domIds = await page.$$eval('#scenarioGrid .sd-card', nodes => nodes.map(n => n.getAttribute('data-scenario-id') || (n.querySelector('.sd-card-title')||{}).textContent));
    // Expect the search 'no-crank' to show the two matching scenarios
    expect(domIds.length).toBe(2);
    expect(domIds.sort()).toEqual(['no-crank','no-crank-11'].sort());

    // ensure no console errors or unexpected 404s
    const filteredConsoleErrors = consoleErrors.filter(e => !e.includes('Failed to load resource'));
    expect(filteredConsoleErrors).toEqual([]);
    expect(badResponses).toEqual([]);

    await context.close();
  });
});

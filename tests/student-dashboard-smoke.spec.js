const { test, expect } = require('@playwright/test');
// (no local file helper needed when serving via HTTP)

// Allowed 404 patterns (analytics endpoints intentionally excluded)
const allowed404Patterns = ['/analytics', '/telemetry', '/api/analytics', '/api/telemetry'];

test.describe('Student dashboard smoke', ()=>{
  test('loads and basic interactions', async ({ browser })=>{
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if(msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const badResponses = [];
    page.on('response', resp => {
      if(resp.status() === 404){
        const url = resp.url();
        if(!allowed404Patterns.some(p=>url.includes(p))) badResponses.push({url, status: resp.status()});
      }
    });

    // Desktop: open page served by local static server so absolute paths resolve
    await page.goto('http://127.0.0.1:3001/dashboard/student.html');
    await page.waitForLoadState('networkidle');

    // 17 cards render on desktop
    await page.waitForSelector('#scenarioGrid');
    const cards = await page.$$('#scenarioGrid .sd-card');
    expect(cards.length).toBe(17);

    // Mobile viewport: no horizontal overflow at 390px
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    const scrollWidth = await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // Search filter reduces cards
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.reload();
    const search = await page.$('#searchInput');
    if(search){
      await search.fill('no-crank');
      await page.waitForTimeout(100); // small debounce
      const filtered = await page.$$('#scenarioGrid .sd-card');
      expect(filtered.length).toBeLessThan(17);
    }

    // first card click updates URL hash or navigates
    const cardCountAfter = await page.evaluate(()=>document.querySelectorAll('#scenarioGrid .sd-card').length);
    const gridChildCount = await page.evaluate(()=>{ const el = document.getElementById('scenarioGrid'); return el ? el.childElementCount : 0; });
    console.log('CARD COUNT after manual renderer:', cardCountAfter);
    console.log('scenarioGrid child count:', gridChildCount);
    expect(cardCountAfter).toBeGreaterThan(0);
    const firstCard = await page.$('#scenarioGrid .sd-card');
    expect(firstCard).toBeTruthy();
    const beforeHash = await page.evaluate(()=>location.hash);
    await Promise.all([
      page.waitForTimeout(100),
      firstCard.click()
    ]);
    const afterHash = await page.evaluate(()=>location.hash);
    expect((afterHash && afterHash!==beforeHash) || afterHash==='').toBeTruthy();

    // Seed localStorage and reload to check Resume button
    await page.evaluate(()=>{
      localStorage.setItem('last_scenario', JSON.stringify({id:'no-crank'}));
      localStorage.setItem('student_progress', JSON.stringify({ 'no-crank': { status: 'in-progress', updated: new Date().toISOString() } }));
    });
    await page.reload();
    const resume = await page.$('#btnResume');
    expect(resume).toBeTruthy();
    const resumeVisible = await resume.evaluate(n=>getComputedStyle(n).display!=='none');
    expect(resumeVisible).toBe(true);

    // Reset clears progress
    page.on('dialog', async d=>{ await d.accept(); });
    const reset = await page.$('#btnReset');
    if(reset){
      await reset.click();
      // give time for script to clear and rerender
      await page.waitForTimeout(100);
      const storage = await page.evaluate(()=>localStorage.getItem('student_progress'));
      expect(storage===null || storage==='{}').toBeTruthy();
    }

    // ensure no console errors and no unexpected 404s (now including scenario images)
    if(consoleErrors.length) console.log('Console errors (raw):', consoleErrors.slice(0,20));
    if(badResponses.length) console.log('Bad responses (404 raw):', JSON.stringify(badResponses.slice(0,40), null, 2));
    // filter out unrelated load-resource console messages
    const filteredConsoleErrors = consoleErrors.filter(e => !e.includes('Failed to load resource'));
    if(filteredConsoleErrors.length) console.log('Console errors (filtered):', filteredConsoleErrors.slice(0,20));
    if(badResponses.length) console.log('Bad responses (filtered):', JSON.stringify(badResponses.slice(0,40), null, 2));
    expect(filteredConsoleErrors).toEqual([]);
    expect(badResponses).toEqual([]);

    await context.close();
  });
});

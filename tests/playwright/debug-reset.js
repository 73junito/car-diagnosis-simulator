const { chromium } = require('playwright');
(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = process.env.PREVIEW_URL || 'http://127.0.0.1:3003/dashboard/student';
  console.log('goto', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.fill('#searchInput','no-match-possible-xyz');
  await page.dispatchEvent('#searchInput','input');
  await page.waitForSelector('.empty-state', { timeout: 3000 });
  console.log('empty present');
  const exists = await page.$('#resetFiltersBtn');
  console.log('reset button exists?', !!exists);
  await page.screenshot({ path: 'debug-before-reset.png', fullPage: true });
  if(exists){
    // call onclick directly to ensure handler runs
    await page.evaluate(()=>{ const btn = document.getElementById('resetFiltersBtn'); if(btn && btn.onclick) btn.onclick(); });
    console.log('invoked reset handler');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'debug-after-reset.png', fullPage: true });
    const cnt = await page.$$eval('#scenarioGrid .sd-card', nodes=>nodes.length);
    console.log('cards after reset:', cnt);
    const filterText = await page.$eval('#filterCount', el => el.textContent);
    console.log('filterCount:', filterText);
  }
  await browser.close();
})();

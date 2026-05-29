const { chromium } = require('playwright');

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });

  page.on('console', msg=>{
    try{
      if (msg.type() === 'error') console.log('[PAGE ERROR]', msg.text());
    }catch(e){/*ignore*/}
  });

  console.log('Opening page (mobile viewport)...');
  await page.goto('https://car-diagnosis-simulator.vercel.app/', { waitUntil: 'networkidle' });
  await page.screenshot({ path:'mobile-home.png', fullPage:true });
  console.log('Saved mobile-home.png');

  console.log('Sampling telemetry values (4 samples, 3s interval)...');
  for (let i=0;i<4;i++){
    const vals = await page.evaluate(()=>{
      return {
        rpm: document.getElementById('diagRpm')?.textContent || null,
        volt: document.getElementById('diagVoltage')?.textContent || null,
        cool: document.getElementById('diagCoolant')?.textContent || null,
        conf: document.getElementById('diagConfidence')?.textContent || null
      };
    });
    console.log('telemetry-sample', i+1, vals);
    await page.waitForTimeout(3000);
  }

  console.log('Capturing desktop screenshot...');
  await page.setViewportSize({ width:1920, height:1080 });
  await page.screenshot({ path:'desktop-home.png', fullPage:true });
  console.log('Saved desktop-home.png');

  await browser.close();
})();

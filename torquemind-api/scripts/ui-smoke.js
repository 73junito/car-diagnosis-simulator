const puppeteer = require('puppeteer');
(async () => {
  const results = { console: [], errors: [], actions: [] };
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
    const text = msg.text();
    results.console.push(text);
    if (msg.type() === 'error') results.errors.push(text);
  });
  page.on('pageerror', err => {
    try { results.errors.push((err && err.stack) ? err.stack : (err && err.message) ? err.message : String(err)); } catch(e){ void e; }
  });

  const base = 'http://localhost:8080/';
  try {
    await page.goto(base + 'index.html', { waitUntil: 'networkidle2', timeout: 30000 });
    results.actions.push('loaded');

    // wait for app bootstrap (DOMContentLoaded handlers) to complete
    try { await page.waitForFunction(() => window.appReady === true, { timeout: 5000 }); } catch (e) { /* continue */ }

    // ensure global wrappers and functions are loaded
    const hasAuthJs = await page.evaluate(() => typeof window.supabaseSignIn === 'function');
    results.actions.push('supabaseSignIn_present:' + hasAuthJs);

    // debug: presence of replay helpers and localStorage class data
    const helpers = await page.evaluate(() => ({ showReplay: typeof globalThis['showReplay'], openStudentDetail: typeof globalThis['openStudentDetail'], classRaw: localStorage.getItem('carSim_class') }));
    results.actions.push('helpers:' + JSON.stringify({ showReplay: helpers.showReplay, openStudentDetail: helpers.openStudentDetail, classRawLen: (helpers.classRaw || '').length }));

    // Inject sample scenarios and seeded class data into the page so preview/start and teacher flows render
    await page.evaluate(() => {
      try {
        window.scenarios = [{ id: 1, index: 1, primarySystem: 'engine', difficulty: 1, symptoms: 'Engine misfire under load', fault: 'spark plugs' }];
        // seed a class with one student who has one replay
        const seeded = [{
          name: 'Test Student',
          id: 'student-1',
          replays: [{ scenario: 1, actions: [{ time: Date.now(), type: 'system', value: 'engine' }, { time: Date.now() + 800, type: 'diagnosis', value: 'spark plugs' }], result: 'needs repair', created_at: new Date().toISOString() }],
          correct: 1, wrong: 0, score: 10, currentLevel: 1, lastUpdated: new Date().toISOString()
        }];
        localStorage.setItem('carSim_class', JSON.stringify(seeded));
        // set a current class id so teacher flows consider class-scoped mode
        localStorage.setItem('carSim_currentClassId', 'local-1');
        // ensure modal creation still works
        if (typeof globalThis['ensureTeacherLoginModal'] === 'function') globalThis['ensureTeacherLoginModal']();
      } catch (e) { void e; }
    });

    // create modal via ensureTeacherLoginModal and check it exists
    const modalCreated = await page.evaluate(() => { if (typeof globalThis['ensureTeacherLoginModal'] === 'function') globalThis['ensureTeacherLoginModal'](); return !!document.getElementById('teacherLoginModal'); });
    results.actions.push('modalCreated:' + modalCreated);

    // click a teacher button if present
    const clickedTeacher = await page.evaluate(() => {
      const ids = ['btn-teacher','btn-teacher-hero'];
      for (const id of ids){ const el = document.getElementById(id); if (el){ el.click(); return id; } }
      const el2 = document.querySelector('.btn-teacher'); if (el2){ el2.click(); return 'btn-teacher-class'; }
      return null;
    });
    results.actions.push('clickedTeacherBtn:' + (clickedTeacher || 'none'));

    // render scenario list so preview/start buttons appear
    await page.evaluate(() => { try { if (typeof globalThis['renderScenarioList'] === 'function') globalThis['renderScenarioList'](); } catch (e) { void e; } });
    // wait a moment then check for teacher modal or teacher screen
    await new Promise(r => setTimeout(r, 700));
    const teacherScreenVisible = await page.evaluate(() => {
      const ts = document.getElementById('teacherScreen'); if (!ts) return false; return (ts.style.display !== 'none');
    });
    results.actions.push('teacherScreenVisible:' + teacherScreenVisible);

    // try scenario preview/start buttons
    const previewClicked = await page.evaluate(() => {
      const p = document.querySelector('.btn-preview'); if (p){ p.click(); return true; } return false; 
    });
    results.actions.push('previewClicked:' + previewClicked);
    await new Promise(r => setTimeout(r, 300));
    const startClicked = await page.evaluate(() => { const s = document.querySelector('.btn-start'); if (s){ s.click(); return true; } return false; });
    results.actions.push('startClicked:' + startClicked);

    // test back-to-landing button
    const backClicked = await page.evaluate(() => { const b = document.querySelector('.btn-back-to-landing'); if (b){ b.click(); return true; } return false; });
    results.actions.push('backClicked:' + backClicked);

    // attempt to open teacher dashboard explicitly and wait for data or error container
    await page.evaluate(() => { try { if (typeof globalThis['setView'] === 'function') globalThis['setView']('teacherScreen'); } catch(e){ void e; } });
    // ensure student list rendered from seeded localStorage
    await page.evaluate(() => { try { if (typeof globalThis['renderFilteredStudents'] === 'function') globalThis['renderFilteredStudents'](); } catch(e){ void e; } });
    // wait for either teacherSummaryPanel or teacherErrorMsg or studentList
    await page.waitForFunction(() => !!document.getElementById('teacherSummaryPanel') || !!document.getElementById('teacherErrorMsg') || !!document.getElementById('studentList'), { timeout: 5000 });
    const teacherPanelExists = await page.evaluate(() => !!document.getElementById('teacherSummaryPanel'));
    const teacherErrorExists = await page.evaluate(() => !!document.getElementById('teacherErrorMsg'));
    results.actions.push('teacherPanelExists:' + teacherPanelExists);
    results.actions.push('teacherErrorExists:' + teacherErrorExists);

    // debug: capture studentList content summary
    const studentListSummary = await page.evaluate(() => {
      const el = document.getElementById('studentList');
      if (!el) return 'no-studentList';
      const btnCount = el.querySelectorAll('button').length;
      const txt = (el.innerText || '').slice(0,200);
      return `${btnCount}|${txt}`;
    });
    results.actions.push('studentListSummary:' + studentListSummary);

    // If studentList appears empty despite seeded data, inject a lightweight test row that calls openStudentDetail
    if (studentListSummary && studentListSummary.startsWith('0|')){
      await page.evaluate(() => {
        try {
          const list = document.getElementById('studentList');
          if (!list) return false;
          const row = document.createElement('div');
          const btn = document.createElement('button'); btn.innerText = 'View';
          btn.addEventListener('click', () => { if (typeof globalThis['openStudentDetail'] === 'function') globalThis['openStudentDetail']('Test Student'); });
          row.appendChild(btn);
          list.appendChild(row);
        } catch(e){ void e; }
      });
      // update summary after injection
      const updated = await page.evaluate(() => { const el = document.getElementById('studentList'); return el ? el.querySelectorAll('button').length : 0; });
      results.actions.push('studentListInjectedButtons:' + updated);
    }

    // try replay view by clicking view-student button; fallback to any button inside #studentList
    const viewStudentClicked = await page.evaluate(() => {
      let v = document.querySelector('.btn-view-student');
      if (v){ v.click(); return true; }
      const list = document.getElementById('studentList');
      if (list){ const btn = list.querySelector('button'); if (btn){ btn.click(); return true; } }
      // fallback: click any button with innerText 'View'
      const any = Array.from(document.querySelectorAll('button')).find(b => /\bView\b/i.test(b.innerText || ''));
      if (any){ any.click(); return true; }
      // last-resort: call openStudentDetail for the seeded student if available
      if (typeof globalThis['openStudentDetail'] === 'function') { try { globalThis['openStudentDetail']('Test Student'); return true; } catch(e){ void e; } }
      return false;
    });
    results.actions.push('viewStudentClicked:' + viewStudentClicked);
    await new Promise(r => setTimeout(r, 500));
    const replayViewerVisible = await page.evaluate(() => { const rv = document.getElementById('replayViewer'); return !!(rv && rv.style.display && rv.style.display !== 'none'); });
    results.actions.push('replayViewerVisible:' + replayViewerVisible);
    const replayViewerState = await page.evaluate(() => { const rv = document.getElementById('replayViewer'); if (!rv) return 'no-replayViewer'; const tl = document.getElementById('replayTimeline'); return (rv.style.display || '') + '|' + (tl ? (tl.textContent || tl.innerText || '').slice(0,200) : 'no-tl'); });
    results.actions.push('replayViewerState:' + replayViewerState);
    // If the replay viewer did not open, call showReplay directly with a small seeded replay as a last-resort for smoke test
    if (!replayViewerVisible){
      await page.evaluate(() => {
        try {
          const fake = { name: 'Test Student', replays: [{ scenario: 1, actions: [{ time: Date.now(), type: 'system', value: 'engine' }, { time: Date.now() + 500, type: 'diagnosis', value: 'spark plugs' }], result: 'needs repair', created_at: new Date().toISOString() }] };
          if (typeof globalThis['showReplay'] === 'function') { globalThis['showReplay'](fake); }
        } catch(e){ void e; }
      });
      await new Promise(r => setTimeout(r, 300));
      const replayViewerVisible2 = await page.evaluate(() => { const rv = document.getElementById('replayViewer'); return !!(rv && rv.style.display && rv.style.display !== 'none'); });
      results.actions.push('replayViewerVisibleAfterFake:' + replayViewerVisible2);
    }

    // collect console errors that mention duplicate or already declared
    const dupErrors = results.console.filter(s => /already been declared|Duplicate|duplicate|Identifier\s+'\w+'\s+has\s+already\s+been\s+declared/i.test(s));
    results.duplicateSignals = dupErrors;

    console.log('UI smoke results:', JSON.stringify(results, null, 2));
  } catch (e){
    console.error('UI smoke script failed', e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();

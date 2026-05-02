#!/usr/bin/env node
// Simple smoke test for TorqueMind API
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TIMEOUT = 5000;
function timeout(ms){ return new Promise(res=>setTimeout(res, ms)); }
async function safeFetch(path, opts){
  const url = BASE + path;
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch(e) { json = text; }
    return { status: res.status, ok: res.ok, body: json };
  } catch (e){ return { status: 0, ok: false, body: String(e) }; }
}

async function run(){
  console.log('TorqueMind smoke test against', BASE);
  // 1. Health check
  const h = await safeFetch('/');
  if (!h.ok) { console.error('Health check failed', h); process.exit(2); }
  console.log('1/7 OK: health');

  // 2. Create class
  const className = 'smoke-test-' + Date.now();
  const c = await safeFetch('/api/classes', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: className }) });
  if (!c.ok) { console.error('Create class failed', c); process.exit(3); }
  const created = (c.body && c.body.class) ? c.body.class : c.body;
  console.log('2/7 OK: created class', created && (created.id || created));
  const classId = created && (created.id || created.classId || created);
  const classCode = created && created.class_code;
  if (!classId){ console.error('No class id returned', created); process.exit(4); }

  // 3. Enroll test student
  const studentId = 'smoke-student-' + Date.now();
  const enrollPayload = classCode ? { code: classCode } : { userId: studentId };
  const e = await safeFetch(`/api/classes/${encodeURIComponent(classId)}/enroll`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(enrollPayload) });
  if (!e.ok) { console.error('Enroll failed', e); process.exit(5); }
  console.log('3/7 OK: enrolled student', studentId);

  // 4. Post replay
  const scenarioId = 1;
  const replayBody = { userId: studentId, scenarioId, actions: [{ type: 'system', value: 'electrical' }], result: 'incorrect', confidence: 'medium', classId };
  const r = await safeFetch('/api/replay', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(replayBody) });
  if (!r.ok) { console.error('Post replay failed', r); process.exit(6); }
  console.log('4/7 OK: posted replay');

  // 5. Post completion
  const comp = await safeFetch('/api/complete', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: studentId, scenarioId, classId }) });
  if (!comp.ok) { console.error('Post completion failed', comp); process.exit(7); }
  console.log('5/7 OK: posted completion');

  // small delay to allow DB writes
  await timeout(500);

  // 6. Fetch teacher data for class
  const td = await safeFetch(`/api/teacher/data?classId=${encodeURIComponent(classId)}`);
  // Support local fallback mode where Supabase is not configured (server returns 501 with message).
  if (!td.ok) {
    const body = td.body || {};
    const errMsg = (body && body.error) ? body.error : (typeof body === 'string' ? body : JSON.stringify(body));
    if (td.status === 501 && String(errMsg).toLowerCase().includes('supabase not configured')) {
      console.warn('6/7 WARNING: teacher data endpoint returned Supabase-not-configured fallback; skipping teacher-data assertions.');
      console.log('\nSMOKE TEST PASSED (fallback mode)');
      process.exit(0);
    }
    console.error('Fetch teacher data failed', td);
    process.exit(8);
  }
  console.log('6/7 OK: fetched teacher data');

  // 7. Assert replay + completion appear
  const body = td.body || {};
  const replays = body.replays || [];
  const completions = body.completions || [];
  const replayFound = replays.some(rp => String(rp.user_id || rp.userId || rp.user) === String(studentId) || (rp.user && String(rp.user) === String(studentId)) );
  const completionFound = completions.some(c => String(c.user_id || c.userId || c.user) === String(studentId));
  if (!replayFound) { console.error('Replay not found in teacher data', { replays }); process.exit(9); }
  if (!completionFound) { console.error('Completion not found in teacher data', { completions }); process.exit(10); }
  console.log('7/7 OK: replay and completion visible in teacher data');

  console.log('\nSMOKE TEST PASSED');
  process.exit(0);
}

// Node fetch availability
if (typeof fetch === 'undefined'){
  console.error('Global fetch not found. Please run on Node 18+ or install a fetch polyfill.');
  process.exit(1);
} else {
  run();
}

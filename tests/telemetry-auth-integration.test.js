const assert = require('assert');
const { requireInstructor } = require('../api/telemetry/access');
const { getRecentEvents } = require('../api/telemetry/events');

function makeReq(headers){ return { headers: headers || {} }; }
function makeRes(){ let statusCode=200; let body=''; return { status(code){ statusCode=code; return this; }, send(s){ body=s; this._status=statusCode; this._body=body; } }; }

async function run(){
  // header-only role resolution
  const r1 = makeReq({ 'x-torquemind-role': 'student' });
  const res1 = makeRes();
  const ok1 = await requireInstructor(r1, res1);
  assert.ok((ok1 === false) || (res1._status === 401));

  // recent audit event recorded with extra fields
  const recent = getRecentEvents();
  const last = recent[recent.length-1];
  assert.ok(last && last.type === 'access_attempt', 'expected access_attempt event');
  assert.strictEqual(last.role, 'student');
  assert.strictEqual(last.allowed, false);
  assert.strictEqual(last.source, 'header');

  // instructor allowed
  const r2 = makeReq({ 'x-torquemind-role': 'instructor' });
  const res2 = makeRes();
  const ok2 = await requireInstructor(r2, res2, ()=>{});
  assert.ok(ok2 !== false, 'expected instructor allowed');

  const recent2 = getRecentEvents();
  const last2 = recent2[recent2.length-1];
  assert.ok(last2 && last2.type === 'access_attempt');
  assert.strictEqual(last2.role, 'instructor');
  assert.strictEqual(last2.allowed, true);

  console.log('Telemetry auth-integration scaffold tests passed.');
}

if (require.main === module) run().catch(err=>{ console.error(err); process.exit(1); });

module.exports = run;

// Jest wrapper so CI runs this as a test-suite
if (typeof test === 'function') {
  test('telemetry auth integration scaffold runs', async () => {
    await run();
  }, 30000);
}

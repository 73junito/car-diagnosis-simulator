const assert = require('assert');
const { resolveUserRole } = require('../api/auth/role');
const { requireInstructor } = require('../api/telemetry/access');
const { getRecentEvents } = require('../api/telemetry/events');

function makeReq(headers){ return { headers: headers || {} }; }
function makeRes(){ let statusCode=200; let body=''; return { status(code){ statusCode=code; return this; }, send(s){ body=s; this._status=statusCode; this._body=body; } }; }

async function run(){
  // header-only role resolution
  const r1 = makeReq({ 'x-torquemind-role': 'student' });
  const res1 = makeRes();
  const ok1 = requireInstructor(r1, res1);
  assert.strictEqual(ok1, false);

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
  const ok2 = requireInstructor(r2, res2, ()=>{});
  assert.ok(ok2 === true || ok2 === undefined, 'expected instructor allowed');

  const recent2 = getRecentEvents();
  const last2 = recent2[recent2.length-1];
  assert.ok(last2 && last2.type === 'access_attempt');
  assert.strictEqual(last2.role, 'instructor');
  assert.strictEqual(last2.allowed, true);

  console.log('Telemetry auth-integration scaffold tests passed.');
}

if (require.main === module) run().catch(err=>{ console.error(err); process.exit(1); });

module.exports = run;

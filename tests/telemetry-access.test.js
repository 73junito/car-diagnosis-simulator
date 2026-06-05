const { requireInstructor } = require('../api/telemetry/access');
const { getRecentEvents } = require('../api/telemetry/events');

function makeReq(role){ return { headers: { 'x-torquemind-role': role } }; }

function makeRes(){
  let statusCode = 200; let body = '';
  return {
    status(code){ statusCode = code; return this; },
    send(s){ body = s; this._status = statusCode; this._body = body; }
  };
}

async function run(){
  // student access should be denied
  const req = makeReq('student');
  const res = makeRes();
  const ok = await requireInstructor(req, res);
  if ((ok !== false && ok !== undefined) && res._status !== 401) {
    throw new Error('Expected unauthorized response for student');
  }

  // instructor allowed
  const req2 = makeReq('instructor');
  const res2 = makeRes();
  const ok2 = await requireInstructor(req2, res2, ()=>{});
  if (ok2 === false) { throw new Error('Expected instructor to be allowed'); }

  // audit event recorded
  const recent = getRecentEvents();
  const last = recent[recent.length-1];
  if (!last || last.type !== 'access_attempt') { throw new Error('Audit event not recorded'); }

  return true;
}

module.exports = run;

// Always register a Jest wrapper so the suite contains at least one test
describe('telemetry access', () => {
  test('script runner completes', async () => {
    await expect(run()).resolves.toBe(true);
  });
});

// Backwards compatibility: allow direct node invocation
if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}

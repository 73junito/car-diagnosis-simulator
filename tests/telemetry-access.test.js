const { hasInstructorAccess, requireInstructor } = require('../api/telemetry/access');
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
  const ok = requireInstructor(req, res);
  if (ok !== false && res._status !== 401) {
    console.error('Expected unauthorized response for student'); process.exit(1);
  }

  // instructor allowed
  const req2 = makeReq('instructor');
  const res2 = makeRes();
  const ok2 = requireInstructor(req2, res2, ()=>{});
  if (!ok2) { console.error('Expected instructor to be allowed'); process.exit(1); }

  // audit event recorded
  const recent = getRecentEvents();
  const last = recent[recent.length-1];
  if (!last || last.type !== 'access_attempt') { console.error('Audit event not recorded'); process.exit(1); }

  console.log('Telemetry access tests passed.');
}

run().catch(err=>{ console.error(err); process.exit(1); });

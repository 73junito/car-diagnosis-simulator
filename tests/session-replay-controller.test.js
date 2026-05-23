// Node-run test script for ReplayController (used by CI step)
const assert = require('assert');
const ReplayController = require('../dashboard/replay-controller');

function mockFetch(data){
  global.fetch = async ()=>({ ok:true, json: async ()=>({ ok:true, data }) });
}

async function testLoadAndNormalize(){
  const rows = [
    { id: '3', created_at: '2020-01-03T00:00:00Z' },
    { id: '2', created_at: '2020-01-02T00:00:00Z' },
    { id: '1', created_at: '2020-01-01T00:00:00Z' }
  ];
  mockFetch(rows);
  const ctl = new ReplayController({ tickMs: 10 });
  const r = await ctl.load(null, 10);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(ctl.events.length, 3);
  // internal order should be oldest-first
  assert.strictEqual(ctl.events[0].id, '1');
  assert.strictEqual(ctl.events[2].id, '3');
  assert.strictEqual(ctl.state, 'ready');
}

async function testMalformedTimestamps(){
  const rows = [ { id:'a', created_at: 'not-a-date' }, { id:'b', created_at: '2020-02-01T00:00:00Z' } ];
  mockFetch(rows);
  const ctl = new ReplayController();
  const r = await ctl.load(null, 10);
  assert.strictEqual(r.ok, true);
  // malformed entry should be filtered out
  assert.strictEqual(ctl.events.length, 1);
  assert.strictEqual(ctl.events[0].id, 'b');
}

async function testPlayPauseStep(){
  const rows = [ { id:'1', created_at:'2020-01-01T00:00:00Z' }, { id:'2', created_at:'2020-01-02T00:00:00Z' } ];
  mockFetch(rows);
  const ctl = new ReplayController({ tickMs: 20 });
  await ctl.load(null, 10);
  assert.strictEqual(ctl.state, 'ready');
  ctl.play();
  assert.ok(ctl.state === 'playing' || ctl.state === 'ended');
  // wait for one tick to advance
  await new Promise(r=>setTimeout(r, 50));
  // should have advanced at least one step or reached end
  assert.ok(ctl.currentIndex >= 0);
  ctl.pause();
  assert.ok(ctl.state === 'paused' || ctl.state === 'ended');
  const prev = ctl.currentIndex;
  ctl.stepForward();
  assert.ok(ctl.currentIndex >= prev);
  ctl.stepBack();
  assert.ok(ctl.currentIndex <= ctl.events.length-1);
  ctl.seek(0);
  assert.strictEqual(ctl.currentIndex, 0);
  ctl.reset();
  assert.strictEqual(ctl.state, 'idle');
}

async function run(){
  try{
    await testLoadAndNormalize();
    await testMalformedTimestamps();
    await testPlayPauseStep();
    console.log('OK');
    process.exit(0);
  }catch(err){
    console.error('Test failed', err);
    process.exit(2);
  }
}

run();

const fs = require('fs');
function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch(e){ console.error('read error',p,e); process.exit(1);} }
const run = readJSON('runs/run-tuned-latest.json');
const results = run.results || [];
const ids = results.map(r=>({ id: r.body && r.body.requestId, status: r.status, ok: r.ok })).filter(x=>x.id);
const logs = readJSON('runs/vercel-filtered-tuned.json');
const map = {};
for(const l of logs){
  for(const entry of l.logs || []){
    const m = entry.message;
    try{
      const obj = JSON.parse(m);
      if(obj.event === 'stateless_decision' || obj.event === 'limiter_decision'){
        if(obj.requestId){ map[obj.requestId] = map[obj.requestId] || {}; map[obj.requestId].allowed = !!obj.allowed; }
      }
      if(obj.event === 'request_completed'){
        if(obj.requestId){ map[obj.requestId] = map[obj.requestId] || {}; map[obj.requestId].completed = true; }
      }
    }catch(e){ /* ignore */ }
  }
}
const totalIds = ids.length;
const successes = results.filter(r=>r.ok).length;
const rateLimited = results.filter(r=>r.status===429).length;
const matched = Object.keys(map).length;
const allowedCount = Object.values(map).filter(x=>x.allowed).length;
const completedCount = Object.values(map).filter(x=>x.completed).length;
console.log({ totalIds, successes, rateLimited, matched, allowedCount, completedCount });
const mismatches = ids.filter(i=>{
  const s = map[i.id];
  if(!s) return true;
  if(s.allowed && !i.ok) return true;
  if(!s.allowed && i.ok) return true;
  return false;
}).slice(0,10);
console.log('mismatches_sample_count', mismatches.length);
if(mismatches.length) console.log('mismatches_sample', mismatches);

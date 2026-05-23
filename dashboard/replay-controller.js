// Simple ReplayController state machine for telemetry event replay
// Internals keep events oldest-first for playback, while /api returns newest-first

class ReplayController {
  constructor(opts = {}){
    this.state = 'idle';
    this.events = [];
    this.currentIndex = -1; // index into events (oldest-first)
    this._interval = null;
    this.tickMs = opts.tickMs || 500;
    this.onStateChange = opts.onStateChange || (()=>{});
    this.onTick = opts.onTick || (()=>{});
  }

  _setState(s){ this.state = s; try{ this.onStateChange(s) }catch(e){} }

  async load(sessionId = null, limit = 100){
    this._setState('loading');
    try{
      const q = [];
      if (sessionId) q.push('session='+encodeURIComponent(sessionId));
      if (limit) q.push('limit='+encodeURIComponent(String(limit)));
      const url = '/api/telemetry/history' + (q.length?('?'+q.join('&')):'');
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('network');
      const body = await res.json();
      if (!body || body.ok === false) { this._setState('error'); return { ok:false } }
      const rows = Array.isArray(body.data) ? body.data : [];
      // filter invalid timestamps and normalize
      const parsed = rows.map(r=>{
        const ts = Date.parse(r.created_at || r.timestamp || r.ts || r.time);
        return Object.assign({}, r, { _ts: Number.isFinite(ts) ? ts : NaN });
      }).filter(r=>Number.isFinite(r._ts));
      // rows from API are newest-first; we want oldest-first for playback
      parsed.sort((a,b)=>a._ts - b._ts);
      this.events = parsed;
      this.currentIndex = this.events.length ? 0 : -1;
      this._setState(this.events.length ? 'ready' : 'ended');
      return { ok:true, count: this.events.length };
    }catch(err){
      this._setState('error');
      return { ok:false, error: err.message };
    }
  }

  play(){
    if (!this.events.length) return;
    if (this.state === 'playing') return;
    this._setState('playing');
    this._interval = setInterval(()=>{
      if (this.currentIndex < this.events.length - 1){
        this.currentIndex += 1;
        try{ this.onTick(this.getCurrentEvent(), this.currentIndex) }catch(e){}
      } else {
        this.stopInterval();
        this._setState('ended');
      }
    }, this.tickMs);
  }

  stopInterval(){ if (this._interval){ clearInterval(this._interval); this._interval = null } }

  pause(){ if (this.state !== 'playing') return; this.stopInterval(); this._setState('paused'); }

  stepForward(){ if (!this.events.length) return; if (this.currentIndex < this.events.length - 1) this.currentIndex += 1; if (this.currentIndex === this.events.length -1) this._setState('ended'); }

  stepBack(){ if (!this.events.length) return; if (this.currentIndex > 0) this.currentIndex -= 1; }

  seek(idx){ if (!this.events.length) return; const i = Math.max(0, Math.min(this.events.length-1, idx)); this.currentIndex = i; if (i === this.events.length-1) this._setState('ended'); else this._setState('ready'); }

  reset(){ this.stopInterval(); this.events = []; this.currentIndex = -1; this._setState('idle'); }

  getCurrentEvent(){ return (this.currentIndex >=0 && this.currentIndex < this.events.length) ? this.events[this.currentIndex] : null }
}

module.exports = ReplayController;

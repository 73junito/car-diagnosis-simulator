(function () {
  'use strict';
  function boot() {
    var factory = window.Aut250MockAdapter;
    var status = document.getElementById('statusMessage');
    if (!factory) { status.textContent = 'Adapter missing.'; return null; }
    var adapter = factory.createAut250MockAdapter();
    var session = adapter.session();
    document.getElementById('sessionLine').textContent = 'Simulated session ' + session.sessionId + ' · AUT-250';
    status.textContent = 'Simulated session ready. Start with Read DTCs.';
    function say(m) { status.textContent = m; }
    function friendly(error) {
      var message = error && error.message ? error.message : String(error);
      return 'Simulated action unavailable: ' + message + ' No success was recorded.';
    }
    function out(id, v) { document.getElementById(id).textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
    function draw(pattern) {
      try {
        var c = document.getElementById('scopeCanvas');
        if (!c || typeof c.getContext !== 'function') return;
        var x = c.getContext('2d');
        if (!x) return;
      x.clearRect(0, 0, c.width, c.height);
      x.strokeStyle = '#59ff9c'; x.lineWidth = 3; x.beginPath();
      if (pattern === 'normal-burn-line') {
        x.moveTo(10, 130); x.lineTo(90, 25); x.lineTo(120, 70); x.lineTo(300, 70); x.lineTo(330, 130); x.lineTo(410, 130);
      } else {
        x.moveTo(10, 130); x.lineTo(410, 130);
      }
      x.stroke();
      } catch (ignore) { /* Canvas is supplementary; text caption remains authoritative. */ }
    }
    document.querySelectorAll('[data-test]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-test');
        var r;
        try { r = adapter.test(id); }
        catch (error) { say(friendly(error)); return; }
        var m = r.measurement || {};
        if (id.indexOf('scan') === 0) out('scanOutput', m);
        else if (id === 'scope-ignition-secondary') {
          draw(m.pattern);
          out('scopeCaption', m.note + ' Pattern: ' + m.pattern + '. Text result: ' + (m.verdict || m.display || m.pattern));
        } else out('dmmDisplay', 'DMM: ' + (m.display || JSON.stringify(m)));
        say('Simulated test recorded: ' + r.testId);
      });
    });
    var repairs = document.getElementById('repairList');
    session.repairCatalog.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = r.label; b.setAttribute('data-repair', r.id);
      b.addEventListener('click', function () {
        var res;
        try { res = adapter.repair(r.id); }
        catch (error) { out('repairOutput', friendly(error)); say(friendly(error)); return; }
        out('repairOutput', res.verification);
        say(res.success ? 'Simulated repair verified.' : 'Simulated repair did not resolve fault.');
      });
      repairs.append(b);
    });
    document.getElementById('saveReasoning').addEventListener('click', function () {
      try {
        adapter.record('reasoning', {
          hypothesis: document.getElementById('hypothesis').value,
          explanation: document.getElementById('explanation').value
        });
        say('Simulated reasoning saved locally.');
      } catch (error) { say(friendly(error)); }
    });
    document.getElementById('exportBtn').addEventListener('click', function () {
      try {
        var bundle = adapter.exportEvidence();
        out('evidencePreview', bundle);
        say('Simulated evidence exported locally. Not for assessment.');
      } catch (error) { say(friendly(error)); }
    });
    document.getElementById('endSessionBtn').addEventListener('click', function () {
      try {
        adapter.record('session-ended', { reason: 'student-ended-simulation' });
        say('Simulated session ended locally. Further actions are unavailable.');
      } catch (error) { say(friendly(error)); }
    });
    return { adapter: adapter, session: session };
  }
  window.Aut250StudentLab = { boot: boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

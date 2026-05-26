const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Simple Mock EventSource
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.closed = false;
    MockEventSource.lastInstance = this;
  }
  close() { this.closed = true; }
  // helpers to simulate events
  triggerOpen() { if (typeof this.onopen === 'function') this.onopen(); }
  triggerMessage(data) { if (typeof this.onmessage === 'function') this.onmessage({ data: JSON.stringify(data) }); }
  triggerError() { if (typeof this.onerror === 'function') this.onerror(); }
}

async function run() {
  const html = fs.readFileSync(path.resolve(__dirname, '../dashboard/live-session.html'), 'utf8');
  const scriptSrc = fs.readFileSync(path.resolve(__dirname, '../dashboard/live-session.js'), 'utf8');
  // CSS not required for this test

  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  const { window } = dom;

  // inject Mock EventSource
  window.EventSource = MockEventSource;

  // evaluate the script in window context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = scriptSrc;
  window.document.body.appendChild(scriptEl);

  // wait a tick
  await new Promise(r => setTimeout(r, 20));

  // assertions
  const status = window.document.querySelector('#conn-status');
  const reconnect = window.document.querySelector('#reconnect');
  const clear = window.document.querySelector('#clear-feed');
  const list = window.document.querySelector('#event-list');

  if (!status) throw new Error('connection status element missing');
  if (!reconnect) throw new Error('reconnect button missing');
  if (!clear) throw new Error('clear button missing');

  // ensure EventSource instance created
  let inst = MockEventSource.lastInstance;
  if (!inst) throw new Error('EventSource instance not created');

  // simulate open
  inst.triggerOpen();
  await new Promise(r => setTimeout(r, 10));
  if (!/Connected|connected/i.test(status.textContent)) throw new Error('did not set connected status');

  // simulate message
  inst.triggerMessage({ type: 'tick', timestamp: new Date().toISOString(), payload: { count: 1 }, activeSessions: 2 });
  await new Promise(r => setTimeout(r, 10));
  if (list.children.length === 0) throw new Error('message did not add to feed');
  if (window.document.querySelector('#active-sessions').textContent !== '2') throw new Error('active sessions not updated');

  // clear feed
  clear.click();
  if (list.children.length !== 0) throw new Error('clear did not empty feed');

  // reconnect should close old and create new
  const old = MockEventSource.lastInstance;
  reconnect.click();
  await new Promise(r => setTimeout(r, 10));
  const neu = MockEventSource.lastInstance;
  if (old === neu) throw new Error('reconnect did not create new EventSource');
  if (!old.closed) throw new Error('old EventSource not closed on reconnect');

  console.log('Live session UI tests passed.');
}

run().catch(err => { console.error(err); process.exit(1); });

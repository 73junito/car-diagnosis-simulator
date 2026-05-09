#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const reportA = path.resolve('reports/student-performance-report.json');
const eventsFile = path.resolve('reports/telemetry-events.json');
let events = [];

if (fs.existsSync(eventsFile)) {
  try { events = JSON.parse(fs.readFileSync(eventsFile, 'utf8')) || []; } catch (e) { events = []; }
}

if (!events.length && fs.existsSync(reportA)) {
  try {
    const r = JSON.parse(fs.readFileSync(reportA, 'utf8'));
    if (Array.isArray(r)) events = r;
    else if (Array.isArray(r.events)) events = r.events;
    else if (Array.isArray(r.sessions)) events = r.sessions;
  } catch (e) { events = []; }
}

if (!events.length) {
  console.error('No events found in reports/telemetry-events.json or reports/student-performance-report.json');
  process.exit(0);
}

const rows = [['timestamp','userId','eventType','action','details']];
for (const ev of events) {
  const ts = ev.timestamp || ev.time || ev.t || '';
  const user = ev.userId || ev.user || (ev.actor && (ev.actor.name || (ev.actor.account && ev.actor.account.name))) || '';
  const type = ev.eventType || ev.type || ev.name || '';
  const action = (ev.payload && (ev.payload.action || ev.payload.name)) || ev.action || '';
  const details = JSON.stringify(ev.payload || ev.details || {});
  rows.push([ts, user, type, action, details]);
}

const out = path.resolve('reports', 'student-performance.csv');
fs.mkdirSync(path.dirname(out), { recursive: true });
const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
fs.writeFileSync(out, csv, 'utf8');
console.log('Wrote', out);

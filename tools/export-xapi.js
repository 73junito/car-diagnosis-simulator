#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const eventsFile = path.resolve('reports/telemetry-events.json');
let events = [];
if (fs.existsSync(eventsFile)) {
  try { events = JSON.parse(fs.readFileSync(eventsFile, 'utf8')) || []; } catch (e) { events = []; }
}

if (!events.length) {
  console.error('No events found in reports/telemetry-events.json');
  process.exit(0);
}

function verbForEvent(ev) {
  const t = (ev.eventType || ev.type || ev.name || '').toLowerCase();
  if (t.includes('complete') || t.includes('completed') || t.includes('finish')) return {id: 'http://adlnet.gov/expapi/verbs/completed', display: {'en-US':'completed'}};
  if (t.includes('start') || t.includes('begin')) return {id: 'http://adlnet.gov/expapi/verbs/initialized', display: {'en-US':'initialized'}};
  if (t.includes('score') || t.includes('graded')) return {id: 'http://adlnet.gov/expapi/verbs/scored', display: {'en-US':'scored'}};
  return {id: 'http://adlnet.gov/expapi/verbs/experienced', display: {'en-US':'experienced'}};
}

const statements = events.map(ev => {
  const ts = ev.timestamp || ev.time || new Date().toISOString();
  const user = ev.userId || ev.user || (ev.actor && (ev.actor.name || (ev.actor.account && ev.actor.account.name))) || 'anonymous';
  const actor = user.includes('@') ? {mbox: 'mailto:' + user} : {name: user};
  const verb = verbForEvent(ev);
  const objectId = ev.activityId || ev.objectId || ev.target || ('urn:activity:' + (ev.eventType || 'unknown'));
  return {
    actor,
    verb,
    object: {
      id: objectId,
      definition: {
        name: { 'en-US': ev.eventType || ev.name || 'event' },
        description: { 'en-US': JSON.stringify(ev.payload || ev.details || {}) }
      }
    },
    timestamp: ts
  };
});

const out = path.resolve('reports', 'xapi-statements.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(statements, null, 2), 'utf8');
console.log('Wrote', out);

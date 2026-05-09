const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'reports', 'telemetry-events.json');

function loadEvents() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function saveEvents(events) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(events, null, 2), 'utf8');
}

function recordEvent(evt) {
  if (!evt || !evt.studentId) throw new Error('event must include studentId');
  const events = loadEvents();
  events.push(Object.assign({ timestamp: new Date().toISOString() }, evt));
  saveEvents(events);
  return evt;
}

module.exports = { loadEvents, saveEvents, recordEvent };

if (require.main === module) {
  // CLI helper: append a small sample event when invoked without args
  const sample = {
    studentId: process.env.TEST_STUDENT || 'student-1',
    scenarioId: process.env.TEST_SCENARIO || 101,
    stepId: process.env.TEST_STEP || 's1-1',
    action: 'step',
    confidence: 0.8,
    elapsedMs: 30000
  };
  recordEvent(sample);
  console.log('Appended sample telemetry event to', FILE);
}

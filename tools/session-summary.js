const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '..', 'reports', 'telemetry-events.json');
const OUT_FILE = path.join(__dirname, '..', 'reports', 'student-performance-report.json');

function loadEvents() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function groupBySession(events) {
  const map = new Map();
  events.forEach(e => {
    const key = `${e.studentId}::${e.scenarioId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return map;
}

function summarize(events) {
  const groups = groupBySession(events);
  const summaries = [];
  for (const [key, evts] of groups.entries()) {
    const [studentId, scenarioId] = key.split('::');
    const diagnosisEvents = evts.filter(e => e.action === 'diagnosis');
    const correctCount = diagnosisEvents.filter(d => d.correct).length;
    const diagAccuracy = diagnosisEvents.length ? Math.round((correctCount / diagnosisEvents.length) * 100) : null;
    const missedSafety = evts.filter(e => e.action === 'safety_ack' && e.acknowledged === false).length;
    const unnecessaryToolUsage = evts.filter(e => e.action === 'use_tool' && e.required === false).length;
    const confidences = evts.filter(e => typeof e.confidence === 'number').map(e => e.confidence);
    const avgConfidence = confidences.length ? +(confidences.reduce((a,b)=>a+b,0)/confidences.length).toFixed(3) : null;
    const elapsed = evts.map(e => typeof e.elapsedMs === 'number' ? e.elapsedMs : 0);
    const timeToResolutionMs = elapsed.length ? Math.max(...elapsed) : null;

    summaries.push({ studentId, scenarioId: Number(scenarioId), diagnosticAccuracy: diagAccuracy, missedSafetySteps: missedSafety, unnecessaryToolUsage, averageConfidence: avgConfidence, timeToResolutionMs, eventsCount: evts.length });
  }
  return summaries;
}

function run() {
  const events = loadEvents();
  const report = {
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    sessions: summarize(events)
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote session summary to', OUT_FILE);
}

if (require.main === module) run();

module.exports = { loadEvents, summarize, run };

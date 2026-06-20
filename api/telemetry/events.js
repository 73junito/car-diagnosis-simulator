const EventEmitter = require('events');
const storage = require('./storage');

const telemetryEmitter = new EventEmitter();
let _idCounter = 1;
let _maxQueueSize = 100;
const _queue = [];
const _recent = [];
let _dropped = 0;

function _makeId() {
  return `evt-${Date.now()}-${_idCounter++}`;
}

function setMaxQueueSize(n) { _maxQueueSize = Number(n) || 100; }
function getQueueLength() { return _queue.length; }
function getDroppedCount() { return _dropped; }
function getRecentEvents() { return _recent.slice(); }

function normalizeEvent(evt = {}) {
  const eventType = evt.event_type || evt.eventType || evt.type;
  return {
    ...evt,
    id: evt.id || _makeId(),
    type: eventType,
    timestamp: evt.timestamp || evt.created_at || new Date().toISOString(),
    session_id: evt.session_id || evt.sessionId || null,
    user_id: evt.user_id || evt.userId || null,
    event_type: eventType,
    payload_json: evt.payload_json || evt.payload || {},
    source: evt.source || 'telemetry',
  };
}

function validateEvent(evt) {
  return Boolean(evt && typeof evt === 'object' && evt.event_type);
}

function addTelemetryEvent(evt) {
  const normalized = normalizeEvent(evt);
  if (!validateEvent(normalized)) return false;

  _queue.push(normalized);
  _recent.push(normalized);
  if (_recent.length > _maxQueueSize) _recent.shift();

  while (_queue.length > _maxQueueSize) {
    _queue.shift();
    _dropped++;
  }

  telemetryEmitter.emit('event', normalized);
  return normalized;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object'
      ? req.body
      : JSON.parse(req.body || '{}');

    const event = addTelemetryEvent(body);
    if (!event) {
      return res.status(400).json({ ok: false, error: 'Invalid event' });
    }

    const saved = await storage.saveTelemetryEvent({
      sessionId: event.session_id,
      userId: event.user_id,
      eventType: event.event_type,
      payload: event.payload_json,
      source: event.source,
    });

    if (!saved.ok) {
      return res.status(200).json({
        ok: false,
        event,
        message: saved.error && saved.error.message,
      });
    }

    return res.status(200).json({ ok: true, event, data: saved.data || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
module.exports.telemetryEmitter = telemetryEmitter;
module.exports.addTelemetryEvent = addTelemetryEvent;
module.exports.setMaxQueueSize = setMaxQueueSize;
module.exports.getQueueLength = getQueueLength;
module.exports.getDroppedCount = getDroppedCount;
module.exports.getRecentEvents = getRecentEvents;


const EventEmitter = require('events');

// In-memory telemetry queue and emitter
const telemetryEmitter = new EventEmitter();
let _idCounter = 1;
let _maxQueueSize = 100;
const _queue = []; // used for future consumption/backpressure (not pushed to disk)
const _recent = []; // recent events for replay to new clients
let _dropped = 0;

function _makeId() {
  return `evt-${Date.now()}-${_idCounter++}`;
}

function setMaxQueueSize(n) { _maxQueueSize = Number(n) || 100; }

function getQueueLength() { return _queue.length; }
function getDroppedCount() { return _dropped; }
function getRecentEvents() { return _recent.slice(); }

function validateEvent(evt) {
  // Minimal validation: require `type` and `timestamp`
  if (!evt || typeof evt !== 'object') return false;
  if (!evt.type) return false;
  if (!evt.timestamp) return false;
  return true;
}

function addTelemetryEvent(evt) {
  if (!validateEvent(evt)) return false;
  if (!evt.id) evt.id = _makeId();

  // enqueue
  _queue.push(evt);
  // keep recent (replay) list trimmed
  _recent.push(evt);
  if (_recent.length > _maxQueueSize) _recent.shift();

  // maintain queue cap/backpressure: drop oldest if too big
  while (_queue.length > _maxQueueSize) {
    _queue.shift();
    _dropped++;
  }

  telemetryEmitter.emit('event', evt);
  return true;
}

module.exports = {
  telemetryEmitter,
  addTelemetryEvent,
  setMaxQueueSize,
  getQueueLength,
  getDroppedCount,
  getRecentEvents,
};

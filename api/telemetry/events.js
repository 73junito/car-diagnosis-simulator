const EventEmitter = require('events');

// Simple in-memory telemetry emitter for scaffolding and tests
const telemetryEmitter = new EventEmitter();

function addTelemetryEvent(evt) {
  telemetryEmitter.emit('event', evt);
}

module.exports = { telemetryEmitter, addTelemetryEvent };

const EventEmitter = require('events');

/**
 * Lightweight in-process event bus for AI runtime lifecycle events.
 *
 * This bus intentionally contains no persistence or transport behavior.
 * External adapters may subscribe and forward events to telemetry,
 * analytics, logging, or durable storage.
 */
class RuntimeEventBus {
  constructor({ maxHistory = 100 } = {}) {
    if (!Number.isInteger(maxHistory) || maxHistory < 0) {
      throw new Error('maxHistory must be a non-negative integer');
    }

    this.emitter = new EventEmitter();
    this.maxHistory = maxHistory;
    this.history = [];
    this.sequence = 0;
  }

  publish(type, payload = {}) {
    if (!type || typeof type !== 'string') {
      throw new Error('Event type must be a non-empty string');
    }

    const event = Object.freeze({
      id: `ai-event-${Date.now()}-${++this.sequence}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
    });

    if (this.maxHistory > 0) {
      this.history.push(event);

      while (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    }

    this.emitter.emit(type, event);
    this.emitter.emit('*', event);

    return event;
  }

  subscribe(type, listener) {
    if (!type || typeof type !== 'string') {
      throw new Error('Subscription type must be a non-empty string');
    }

    if (typeof listener !== 'function') {
      throw new Error('Subscription listener must be a function');
    }

    this.emitter.on(type, listener);

    return () => {
      this.emitter.removeListener(type, listener);
    };
  }

  once(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    this.emitter.once(type, listener);
  }

  getHistory({ type = null, limit = null } = {}) {
    let events = this.history.slice();

    if (type) {
      events = events.filter((event) => event.type === type);
    }

    if (Number.isInteger(limit) && limit >= 0) {
      events = events.slice(-limit);
    }

    return events;
  }

  clearHistory() {
    this.history = [];
  }

  removeAllListeners(type) {
    this.emitter.removeAllListeners(type);
  }
}

module.exports = RuntimeEventBus;

const RuntimeEventBus = require('../../../src/ai/events/runtime-event-bus');

describe('RuntimeEventBus', () => {
  test('publishes an event to a named subscriber', () => {
    const bus = new RuntimeEventBus();
    const listener = jest.fn();

    bus.subscribe('process.completed', listener);
    const event = bus.publish('process.completed', {
      processId: 'p1',
    });

    expect(listener).toHaveBeenCalledWith(event);
    expect(event.type).toBe('process.completed');
    expect(event.payload.processId).toBe('p1');
  });

  test('publishes every event to wildcard subscribers', () => {
    const bus = new RuntimeEventBus();
    const listener = jest.fn();

    bus.subscribe('*', listener);
    bus.publish('agent.registered', {
      agentId: 'a1',
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe removes a listener', () => {
    const bus = new RuntimeEventBus();
    const listener = jest.fn();

    const unsubscribe = bus.subscribe('request.submitted', listener);

    unsubscribe();

    bus.publish('request.submitted', {
      requestId: 'r1',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  test('trims history to the configured maximum', () => {
    const bus = new RuntimeEventBus({
      maxHistory: 2,
    });

    bus.publish('one');
    bus.publish('two');
    bus.publish('three');

    expect(bus.getHistory().map((event) => event.type)).toEqual([
      'two',
      'three',
    ]);
  });
});

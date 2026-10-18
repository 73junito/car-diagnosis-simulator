const { createOscilloscope } = require('../../dashboard/student/aut250-lab-assets/src/oscilloscope');

const RAMP = [
  { t: 0, v: 0 }, { t: 1, v: 2 }, { t: 2, v: 6 }, { t: 3, v: 6 }, { t: 4, v: 1 }
];

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

function channels() {
  return [
    { id: 'primary-current', label: 'Supplied primary channel', unit: 'A', timeUnit: 'ms', samples: RAMP },
    { id: 'other', label: 'Supplied second channel', unit: 'V', timeUnit: 'ms', samples: RAMP.map((s) => ({ t: s.t, v: s.v / 2 })) }
  ];
}

describe('AUT-250 lab assets — virtual oscilloscope', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('starts with an explicit no-data state and a textual alternative', () => {
    const scope = createOscilloscope({ mount: mount() });
    expect(scope.mount.textContent).toMatch(/No waveform data supplied/);
    expect(scope.mount.querySelector('canvas')).not.toBeNull();
    expect(scope.getState().channels).toHaveLength(0);
  });

  test('renders supplied channels, derives descriptive statistics, and lists samples as text', () => {
    const scope = createOscilloscope({ mount: mount() });
    const result = scope.setChannels(channels());
    expect(result.channelCount).toBe(2);
    scope.renderNow();
    const state = scope.getState();
    expect(state.channels[0].stats).toEqual({
      count: 5, min: 0, max: 6, mean: 3, peakToPeak: 6, firstT: 0, lastT: 4, span: 4
    });
    const description = scope.mount.querySelector('.tm-scope__description').textContent;
    expect(description).toMatch(/5 supplied samples/);
    expect(description).toMatch(/peak-to-peak 6 A/);
    expect(scope.mount.querySelectorAll('.tm-scope__sample-table tr')).toHaveLength(6);
  });

  test('reports trigger results from supplied samples and explains absent crossings', () => {
    const scope = createOscilloscope({ mount: mount() });
    scope.setChannels(channels());
    expect(scope.setTrigger({ channelId: 'primary-current', level: 3, edge: 'rising' }).ok).toBe(true);
    const found = scope.getTriggerResult();
    expect(found.found).toBe(true);
    expect(found.t).toBe(2);
    scope.setTrigger({ level: 99, edge: 'rising' });
    const missing = scope.getTriggerResult();
    expect(missing.found).toBe(false);
    expect(scope.mount.querySelector('.tm-scope__description').textContent).toMatch(/No rising crossing of 99/);
  });

  test('rejects unsupported trigger, timebase, and scale input', () => {
    const scope = createOscilloscope({ mount: mount() });
    scope.setChannels(channels());
    expect(scope.setTrigger({ channelId: 'not-a-channel', level: 1 }).ok).toBe(false);
    expect(scope.setTrigger({ level: 'high' }).ok).toBe(false);
    expect(scope.setTrigger({ edge: 'sideways' }).ok).toBe(false);
    expect(scope.setTimebase(0).ok).toBe(false);
    expect(scope.setTimebase(-5).ok).toBe(false);
    expect(scope.setVerticalScale('not-a-channel', 1).ok).toBe(false);
    expect(scope.setVerticalScale('primary-current', 0).ok).toBe(false);
  });

  test('pause and resume are reflected in state and controls', () => {
    const scope = createOscilloscope({ mount: mount() });
    scope.setChannels(channels());
    const button = scope.mount.querySelector('.tm-scope__transport button');
    expect(scope.isRunning()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    scope.setRunning(false);
    expect(scope.isRunning()).toBe(false);
    expect(button.textContent).toMatch(/Resume/);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    scope.setRunning(true);
    expect(button.textContent).toMatch(/Pause/);
  });

  test('channel visibility and unsupported channels are handled explicitly', () => {
    const scope = createOscilloscope({ mount: mount() });
    scope.setChannels(channels());
    expect(scope.setVisible('other', false).ok).toBe(true);
    expect(scope.getState().channels[1].visible).toBe(false);
    expect(scope.setVisible('nope', true).ok).toBe(false);
  });

  test('malformed channel data is rejected without inventing samples', () => {
    const scope = createOscilloscope({ mount: mount() });
    const result = scope.setChannels([
      { id: 'broken', samples: [{ t: 'x', v: 1 }] },
      { samples: RAMP }
    ]);
    expect(result.ok).toBe(false);
    expect(result.channelCount).toBe(0);
    expect(result.issues.join(' ')).toMatch(/requires at least one valid sample|requires an id/);
    expect(scope.mount.textContent).toMatch(/No waveform data supplied/);
  });
});

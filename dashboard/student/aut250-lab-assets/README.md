# AUT-250 Interactive Laboratory Assets (Simulated)

Reusable, data-driven laboratory equipment and vehicle-component assets for the
AutoLearnPro virtual automotive classroom.

**Status: developmental simulation.** Every value shown by these assets comes
from an external provider payload. The demonstration payload in `data/` is
**invented illustrative input**, not a vehicle measurement, an OEM
specification, a real diagnostic trouble code, a tolerance, or a diagnostic
conclusion. The assets perform no grading, draw no pass/fail verdict, and are
not yet integrated into the student laboratory.

## Owned paths

- `dashboard/student/aut250-lab-assets/**`
- `tests/aut250-lab-assets/**`

Nothing outside these paths is modified. The student laboratory
(`dashboard/student/aut250-lab-ui/`), the diagnostic engine (`engine/`), the
DCAF evidence contract, Supabase, Cloudflare configuration, and production
assessment systems are untouched and unreferenced.

## What is included

| Asset | File | Purpose |
| --- | --- | --- |
| Digital multimeter | `src/multimeter.js` | Voltage, resistance, and continuity display with selectable units, animated probes, and positive/negative leads |
| Automotive oscilloscope | `src/oscilloscope.js` | Animated multi-channel waveform rendering, voltage and time scales, trigger controls, pause/resume, textual waveform description |
| OBD-II scan tool | `src/scan-tool.js` | Trouble codes, freeze frame, live data, misfire counters, operating conditions, supplied repair verification |
| Vehicle components | `src/vehicle-components.js` | Reusable training geometry for battery, ignition coil, spark plug, harness, connectors, cylinders, grounds, and power/signal circuits |
| Data contract | `src/data-contract.js` | Unit families, deterministic display conversion, validation primitives |
| Normalization | `src/scenario-data.js` | Measurement, sample, and trigger validation and descriptive statistics |
| Showcase | `index.html`, `src/showcase.js` | Standalone page demonstrating every asset with illustrative input |

## Running the showcase

Serve the repository root and open:

`dashboard/student/aut250-lab-assets/index.html`

No build step, bundler, or dependency is required. Scripts load in dependency
order from `src/` and `data/`.

## Design rules enforced by tests

1. **No invented readings.** If a provider supplies nothing, the asset says
   "not supplied". It never fabricates a number, code, waveform, or result.
2. **No invented specifications.** No tolerance, rating, or pass/fail
   statement appears anywhere in the assets.
3. **No diagnostic conclusions.** The oscilloscope describes supplied samples
   statistically; interpretation remains the student's responsibility.
4. **Deterministic rendering.** The same payload produces the same display.
   Animation only reveals supplied samples progressively.
5. **Reusable and isolated.** Each asset mounts into any container element,
   has no database dependency, and produces no assessment outcome.

## Asset API summary

```js
const dmm = Aut250LabAssets.Multimeter.createMultimeter({ mount: element });
dmm.setMeasurement({ mode: 'dc-voltage', value: 12.62, unit: 'V' });
dmm.setDisplayUnit('mV');
dmm.setMeasurement(null);

const scope = Aut250LabAssets.Oscilloscope.createOscilloscope({ mount: element });
scope.setChannels([{ id, label, unit, timeUnit, samples: [{ t, v }] }]);
scope.setTrigger({ channelId, level, edge: 'rising' });
scope.setTimebase(2);
scope.setVerticalScale(channelId, 1);
scope.setRunning(false);
scope.getTriggerResult();

const scan = Aut250LabAssets.ScanTool.createScanTool({ mount: element });
scan.setData({ dtcs, freezeFrame, liveData, misfireCounters, operatingConditions, repairVerification });
scan.clear();

const parts = Aut250LabAssets.VehicleComponents.createComponentLibrary({ mount: element });
parts.setComponents([{ id, label, category, description, terminals }]);
parts.select(id);
parts.setHighlight(id, true);
```

Every mutator returns a result object. Unsupported input returns
`{ ok: false, issues: [...] }` or `{ ok: false, reason: '...' }` and is
surfaced in the interface rather than silently substituted.

## Documentation

- `INTEGRATION.md` — provider contract and integration sequence
- `ACCESSIBILITY.md` — keyboard, screen-reader, and fallback behaviour
- `PERFORMANCE.md` — rendering and resource considerations

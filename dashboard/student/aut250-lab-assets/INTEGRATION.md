# Integration documentation — AUT-250 interactive laboratory assets

This branch adds assets only. **It does not integrate them.** Integration is a
separate, reviewed pull request.

## 1. Provider payload contract (v0.1.0)

The assets consume one plain object. All fields are optional; anything absent
is reported as "not supplied".

```js
{
  contractVersion: '0.1.0',
  source: { kind, illustrative, label, notice },
  multimeter: {
    measurements: [
      { id, label, mode: 'dc-voltage' | 'ac-voltage' | 'resistance' | 'dc-current',
        value: <finite number>, unit, quality, testPoint: { componentId, terminalId } },
      { id, label, mode: 'continuity', continuity: 'open' | 'closed', resistanceOhm, testPoint }
    ]
  },
  oscilloscope: {
    channels: [
      { id, label, unit, timeUnit, samples: [{ t: <finite number>, v: <finite number> }],
        vertical: { min, max } }
    ]
  },
  scanTool: {
    vehicle: { <label>: <value> },
    dtcs: [{ code, description, status, type }],
    freezeFrame: { dtcCode, conditions: [{ label, value, unit }] },
    liveData: [{ pid, label, value, unit }],
    misfireCounters: [{ cylinder, count, window }],
    operatingConditions: [{ label, value, unit }],
    repairVerification: { dtcCleared, monitorStatus, notes, evidenceRef }
  },
  components: [
    { id, label, category, description, highlightable,
      terminals: [{ id, label, role }] }
  ]
}
```

### Required versus optional

| Field | Rule |
| --- | --- |
| `dtcs[].code` | Required non-empty string. Entries without a code are dropped and reported. |
| `liveData[].label`, `liveData[].value` | Both required. `value` may be a number or a string. |
| `misfireCounters[].cylinder`, `.count` | `cylinder` a string, `count` a finite number. |
| `components[].id` | Required. Entries without an id are dropped and reported. |
| `components[].category` | Must be one of the supported categories; otherwise a generic training shape is shown and the substitution is reported. |
| `oscilloscope.channels[].samples` | At least one `{ t, v }` pair with finite numbers. Non-finite samples are dropped and reported. |
| `repairVerification` | Shown only when supplied. Absent input renders "not supplied"; no outcome is assumed. |

Supported component categories: `battery`, `ignition-coil`, `spark-plug`,
`wiring-harness`, `connector`, `cylinder`, `ground`, `circuit-power`,
`circuit-signal`.

### Unit handling

`src/data-contract.js` defines display-only unit families: voltage (`V`, `mV`),
resistance (`ohm`, `kohm`, `Mohm`), current (`A`, `mA`), time (`s`, `ms`, `us`).
Selecting a display unit rescales a **supplied** value within its own family.
Incompatible or unknown units are refused with a reason and the previous
display is retained.

## 2. Integration sequence (recommended)

1. Approve and merge this assets PR independently.
2. Confirm the canonical scenario data provider contract with the owner of the
   evidence contract workstream.
3. Create a separate integration branch that:
   - adds a thin adapter mapping the provider payload to the shapes above;
   - mounts the assets inside the student laboratory shell;
   - maps the local `--tm-assets-*` custom properties to the shared theme
     tokens (`theme/tokens.css`) instead of the local palette.
4. Re-run this branch's tests plus the student laboratory suite.
5. Obtain accessibility, SME scenario-truth, and privacy review before any
   pilot use.

## 3. Explicit non-goals

- No scoring, grading, assessment eligibility, or competency logic.
- No persistence, database, telemetry, or research data collection.
- No modification of scenario truth or of the diagnostic engine.
- No production endpoints, migrations, or deployment configuration.

## 4. Theme token mapping (for the integration PR)

| Local custom property | Intended shared token |
| --- | --- |
| `--tm-assets-bg` | `--tm-bg` |
| `--tm-assets-surface` | `--tm-surface` |
| `--tm-assets-surface-2` | `--tm-surface-2` |
| `--tm-assets-text` | `--tm-text` |
| `--tm-assets-muted` | `--tm-muted` |
| `--tm-assets-border` | `--tm-border` |
| `--tm-assets-primary` | `--tm-primary` |
| `--tm-assets-accent` | `--tm-primary-2-text` |
| `--tm-assets-focus` | `--tm-focus-ring` |

The oscilloscope and multimeter screens intentionally use dark instrument
surfaces; verify contrast against the shared tokens during integration.

## 5. Verification performed on this branch

- Isolated Jest suite for the assets (`tests/aut250-lab-assets/`).
- JavaScript syntax checks for every source file.
- Scoped ESLint run over the owned JavaScript files.
- `git diff --check` for whitespace errors.

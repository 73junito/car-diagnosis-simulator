# Engineering Computation Foundation

## Scope

This foundation introduces a tool-neutral artifact contract between scientific computation and the browser diagnostic runtime.

The first generator uses Python with NumPy, SciPy, pandas, and Matplotlib. Those libraries are implementation tools; they are not evidence authorities. Generated values retain an explicit evidence role.

## Initial flow

```text
project-authored model inputs
        |
        v
Python scientific computation
        |
        v
versioned JSON artifact
        |
        v
schema + semantic validation
        |
        v
future browser adapter
        |
        v
engineering comparison runtime
```

## Evidence boundary

The committed relay/load artifact is a generic project-authored training model. Its numeric result reproduces the existing example:

- healthy current: 1.989 A
- high-resistance model current: 1.593 A
- delta: -0.396 A

These values are not a vehicle specification and cannot be converted into an authoritative pass/fail result by the artifact contract.

## Files

- `data/engineering/schemas/engineering-model-artifact.schema.json` — versioned structural contract.
- `data/engineering/generated/relay-load-high-resistance.json` — committed deterministic example.
- `engineering/python/requirements.txt` — scientific Python dependencies.
- `engineering/python/generate_relay_load_model.py` — reproducible generator; also emits CSV and PNG locally.
- `scripts/verify-engineering-artifacts.js` — schema and semantic validator.
- `tests/engineering-artifact-contract.test.js` — regression tests for evidence boundaries.

## Generation

From the repository root, after creating a Python environment and installing `engineering/python/requirements.txt`:

```text
python engineering/python/generate_relay_load_model.py
```

The script writes JSON, CSV, and PNG outputs under `data/engineering/generated/`. JSON is the contractual interchange format. CSV and PNG are derived analysis/visualization outputs.

## Validation

```text
node scripts/verify-engineering-artifacts.js
```

Validation deliberately applies rules that JSON Schema alone cannot express safely, including:

- project-authored models cannot declare themselves authoritative specifications;
- project-authored models cannot use authoritative reference statuses;
- changed/unchanged deltas must equal observed minus baseline;
- unavailable values must remain explicitly unavailable;
- project-model provenance must retain the project-authored training-model evidence role.

## Next boundary

ngspice may be added only after it emits the same artifact contract. Simulator output must not bypass evidence role, applicability, domain, or comparability validation.

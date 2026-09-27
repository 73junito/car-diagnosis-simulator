"""Generate deterministic sensor training-model artifacts.

These are project-authored training examples, not vehicle specifications.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "engineering" / "generated"
OUT.mkdir(parents=True, exist_ok=True)

INPUT_PERCENT = 50.0
SIGNAL_MIN_V = 0.5
SIGNAL_MAX_V = 4.5

healthy_signal = float(
    SIGNAL_MIN_V + (INPUT_PERCENT / 100.0) * (SIGNAL_MAX_V - SIGNAL_MIN_V)
)
short_ground_signal = 0.0
delta = short_ground_signal - healthy_signal

short_artifact = {
    "schemaVersion": "1.0.0",
    "artifactId": "sensor-signal-short-ground-v1",
    "modelId": "sensor-linear-transfer-short-ground-training-model",
    "evidenceRole": "project_authored_training_model",
    "generator": {"tool": "python-numpy-pandas-matplotlib", "version": "1.0.0"},
    "domain": {
        "system": "low-voltage-three-wire-sensor",
        "voltageClass": "5V-reference-training-example",
        "applicability": "generic project-authored sensor training model only",
    },
    "quantity": {"quantityType": "voltage", "unit": "V"},
    "baseline": {"value": round(healthy_signal, 3), "label": "healthy modeled signal"},
    "observed": {"value": round(short_ground_signal, 3), "label": "signal short-to-ground model"},
    "comparison": {
        "status": "changed",
        "delta": round(delta, 3),
        "interpretation": "numeric_delta_only",
        "authoritativeSpecification": False,
        "reason": "Project-authored idealized sensor training-model delta; not a vehicle specification.",
    },
    "provenance": {
        "method": "linear 0.5-4.5 V training transfer at 50 percent input with idealized signal short-to-ground",
        "sourceType": "project_model",
        "reproducible": True,
    },
}

unavailable_artifact = {
    "schemaVersion": "1.0.0",
    "artifactId": "sensor-ground-high-resistance-unavailable-v1",
    "modelId": "sensor-ground-high-resistance-boundary",
    "evidenceRole": "project_authored_training_model",
    "generator": {"tool": "python-contract-boundary", "version": "1.0.0"},
    "domain": {
        "system": "low-voltage-three-wire-sensor",
        "voltageClass": "5V-reference-training-example",
        "applicability": "generic project-authored sensor training model only",
    },
    "quantity": {"quantityType": "voltage", "unit": "V"},
    "baseline": {"value": round(healthy_signal, 3), "label": "healthy modeled signal"},
    "observed": None,
    "comparison": {
        "status": "unavailable",
        "interpretation": "not_available",
        "authoritativeSpecification": False,
        "reason": "High-resistance sensor-ground behavior depends on sensor and circuit design; a numeric fault voltage is intentionally not inferred.",
    },
    "provenance": {
        "method": "explicit unsupported-behavior boundary from project-authored sensor training profile",
        "sourceType": "project_model",
        "reproducible": True,
    },
}

(OUT / "sensor-signal-short-ground.json").write_text(
    json.dumps(short_artifact, indent=2) + "\n", encoding="utf-8"
)
(OUT / "sensor-ground-high-resistance-unavailable.json").write_text(
    json.dumps(unavailable_artifact, indent=2) + "\n", encoding="utf-8"
)

frame = pd.DataFrame(
    [
        {"state": "healthy", "signal_V": healthy_signal},
        {"state": "signal_short_ground", "signal_V": short_ground_signal},
    ]
)
frame.to_csv(OUT / "sensor-signal-short-ground.csv", index=False)

fig, ax = plt.subplots()
ax.bar(frame["state"], frame["signal_V"])
ax.set_ylabel("Signal voltage (V)")
ax.set_title("Sensor training model")
fig.tight_layout()
fig.savefig(OUT / "sensor-signal-short-ground.png", dpi=144)
plt.close(fig)

# NumPy remains part of the deterministic computation path.
assert np.isclose(healthy_signal, 2.5)

print(json.dumps(short_artifact, indent=2))
print(json.dumps(unavailable_artifact, indent=2))

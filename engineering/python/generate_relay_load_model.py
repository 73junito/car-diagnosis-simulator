"""Generate the deterministic relay/load training-model artifact.

This model is project-authored training evidence. It is not a vehicle specification.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import constants
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "engineering" / "generated"
OUT.mkdir(parents=True, exist_ok=True)

SUPPLY_V = 12.0
BASELINE_RESISTANCE_OHM = 12.0 / 1.989
ADDED_RESISTANCE_OHM = 1.5

baseline_current = float(np.divide(SUPPLY_V, BASELINE_RESISTANCE_OHM))
fault_current = float(np.divide(SUPPLY_V, BASELINE_RESISTANCE_OHM + ADDED_RESISTANCE_OHM))
delta = fault_current - baseline_current

artifact = {
    "schemaVersion": "1.0.0",
    "artifactId": "relay-load-high-resistance-v1",
    "modelId": "relay-high-resistance-training-model",
    "evidenceRole": "project_authored_training_model",
    "generator": {"tool": "python-numpy-scipy-pandas-matplotlib", "version": "1.0.0"},
    "domain": {
        "system": "low-voltage-relay-load",
        "voltageClass": "12V-training-example",
        "applicability": "generic project-authored training model only"
    },
    "quantity": {"quantityType": "current", "unit": "A"},
    "baseline": {"value": round(baseline_current, 3), "label": "healthy model"},
    "observed": {"value": round(fault_current, 3), "label": "high-resistance model"},
    "comparison": {
        "status": "changed",
        "delta": round(delta, 3),
        "interpretation": "numeric_delta_only",
        "authoritativeSpecification": False,
        "reason": "Project-authored training-model delta; not a vehicle specification."
    },
    "provenance": {
        "method": "Ohm's law with deterministic project-authored resistance values",
        "sourceType": "project_model",
        "reproducible": True
    }
}

(OUT / "relay-load-high-resistance.json").write_text(
    json.dumps(artifact, indent=2) + "\n", encoding="utf-8"
)

frame = pd.DataFrame([
    {"state": "healthy", "voltage_V": SUPPLY_V, "resistance_ohm": BASELINE_RESISTANCE_OHM, "current_A": baseline_current},
    {"state": "high_resistance", "voltage_V": SUPPLY_V, "resistance_ohm": BASELINE_RESISTANCE_OHM + ADDED_RESISTANCE_OHM, "current_A": fault_current}
])
frame.to_csv(OUT / "relay-load-high-resistance.csv", index=False)

fig, ax = plt.subplots()
ax.bar(frame["state"], frame["current_A"])
ax.set_ylabel("Current (A)")
ax.set_title("Relay/load training model")
fig.tight_layout()
fig.savefig(OUT / "relay-load-high-resistance.png", dpi=144)
plt.close(fig)

# Touch scipy.constants deliberately so the initial scientific environment verifies SciPy import.
assert constants.e > 0

print(json.dumps(artifact, indent=2))

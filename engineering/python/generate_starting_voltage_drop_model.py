"""Generate deterministic starting-system cable voltage-drop training artifacts.

The modeled drops are project-authored training values. The 500 A test current is
taken from an existing source-backed repository specification for the cited 12 V
battery-cable procedure; the generated voltage drops are not themselves source
specifications.
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

TEST_CURRENT_A = 500.0
WITHIN_RESISTANCE_OHM = 0.0007
EXCEEDS_RESISTANCE_OHM = 0.0009

within_drop = float(TEST_CURRENT_A * WITHIN_RESISTANCE_OHM)
exceeds_drop = float(TEST_CURRENT_A * EXCEEDS_RESISTANCE_OHM)

def artifact(artifact_id: str, model_id: str, observed: float, resistance: float, label: str) -> dict:
    return {
        "schemaVersion": "1.0.0",
        "artifactId": artifact_id,
        "modelId": model_id,
        "evidenceRole": "project_authored_training_model",
        "generator": {"tool": "python-numpy-pandas-matplotlib", "version": "1.0.0"},
        "domain": {
            "system": "starting-cable-voltage-drop",
            "voltageClass": "12V-source-applicable-training-example",
            "applicability": "project-authored cable-resistance model evaluated at the selected 500 A source-backed test current"
        },
        "quantity": {"quantityType": "voltage_drop", "unit": "V"},
        "baseline": {"value": 0.0, "label": "ideal zero-drop conductor model"},
        "observed": {"value": round(observed, 3), "label": label},
        "comparison": {
            "status": "changed",
            "delta": round(observed, 3),
            "interpretation": "numeric_delta_only",
            "authoritativeSpecification": False,
            "reason": "Project-authored cable-resistance model output; authoritative interpretation must be performed separately against an applicable source record."
        },
        "provenance": {
            "method": f"Ohm's law V=IR using {TEST_CURRENT_A:.0f} A and project-authored cable resistance {resistance:.7f} ohm",
            "sourceType": "project_model",
            "reproducible": True,
            "sourceId": "delco-remy-diagnostic-procedures-manual"
        }
    }

within_artifact = artifact(
    "starting-cable-drop-within-candidate-v1",
    "starting-cable-drop-0p35-training-model",
    within_drop,
    WITHIN_RESISTANCE_OHM,
    "modeled total cable drop"
)

exceeds_artifact = artifact(
    "starting-cable-drop-exceeds-candidate-v1",
    "starting-cable-drop-0p45-training-model",
    exceeds_drop,
    EXCEEDS_RESISTANCE_OHM,
    "modeled total cable drop"
)

open_artifact = {
    "schemaVersion": "1.0.0",
    "artifactId": "starting-cable-open-unavailable-v1",
    "modelId": "starting-cable-open-boundary",
    "evidenceRole": "project_authored_training_model",
    "generator": {"tool": "python-contract-boundary", "version": "1.0.0"},
    "domain": {
        "system": "starting-cable-voltage-drop",
        "voltageClass": "12V-source-applicable-training-example",
        "applicability": "generic starting-cable open-circuit training boundary"
    },
    "quantity": {"quantityType": "voltage_drop", "unit": "V"},
    "baseline": {"value": 0.0, "label": "ideal zero-drop conductor model"},
    "observed": None,
    "comparison": {
        "status": "unavailable",
        "interpretation": "not_available",
        "authoritativeSpecification": False,
        "reason": "Open-circuit cable-drop behavior is not represented as a finite modeled voltage drop for authoritative comparison."
    },
    "provenance": {
        "method": "explicit open-circuit non-comparability boundary",
        "sourceType": "project_model",
        "reproducible": True
    }
}

for name, value in [
    ("starting-cable-drop-within-candidate.json", within_artifact),
    ("starting-cable-drop-exceeds-candidate.json", exceeds_artifact),
    ("starting-cable-open-unavailable.json", open_artifact),
]:
    (OUT / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")

frame = pd.DataFrame([
    {"case": "within_candidate", "current_A": TEST_CURRENT_A, "resistance_ohm": WITHIN_RESISTANCE_OHM, "voltage_drop_V": within_drop},
    {"case": "exceeds_candidate", "current_A": TEST_CURRENT_A, "resistance_ohm": EXCEEDS_RESISTANCE_OHM, "voltage_drop_V": exceeds_drop},
])
frame.to_csv(OUT / "starting-cable-voltage-drop.csv", index=False)

fig, ax = plt.subplots()
ax.bar(frame["case"], frame["voltage_drop_V"])
ax.set_ylabel("Modeled cable voltage drop (V)")
ax.set_title("Starting-system cable-drop training models")
fig.tight_layout()
fig.savefig(OUT / "starting-cable-voltage-drop.png", dpi=144)
plt.close(fig)

assert np.isclose(within_drop, 0.35)
assert np.isclose(exceeds_drop, 0.45)

print(json.dumps(within_artifact, indent=2))
print(json.dumps(exceeds_artifact, indent=2))
print(json.dumps(open_artifact, indent=2))

"""Generate deterministic PWM actuator training-model artifacts.

These are project-authored mathematical training examples, not vehicle specifications
and not predictions of actuator response.
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

SUPPLY_V = 12.0
DUTY_PERCENT = 30.0

healthy_average = float(SUPPLY_V * (DUTY_PERCENT / 100.0))
short_ground_average = 0.0
delta = short_ground_average - healthy_average

short_artifact = {
    "schemaVersion": "1.0.0",
    "artifactId": "pwm-actuator-short-ground-v1",
    "modelId": "pwm-actuator-short-ground-training-model",
    "evidenceRole": "project_authored_training_model",
    "generator": {"tool": "python-numpy-pandas-matplotlib", "version": "1.0.0"},
    "domain": {
        "system": "low-voltage-pwm-actuator",
        "voltageClass": "12V-training-example",
        "applicability": "generic project-authored PWM command model only"
    },
    "quantity": {"quantityType": "voltage", "unit": "V"},
    "baseline": {"value": round(healthy_average, 3), "label": "healthy PWM average model"},
    "observed": {"value": round(short_ground_average, 3), "label": "PWM short-to-ground model"},
    "comparison": {
        "status": "changed",
        "delta": round(delta, 3),
        "interpretation": "numeric_delta_only",
        "authoritativeSpecification": False,
        "reason": "Project-authored PWM average training-model delta; not a vehicle specification or actuator-response model."
    },
    "provenance": {
        "method": "ideal PWM average Vavg = supply voltage × duty cycle with idealized command short-to-ground",
        "sourceType": "project_model",
        "reproducible": True
    }
}

open_artifact = {
    "schemaVersion": "1.0.0",
    "artifactId": "pwm-actuator-open-command-unavailable-v1",
    "modelId": "pwm-actuator-open-command-boundary",
    "evidenceRole": "project_authored_training_model",
    "generator": {"tool": "python-contract-boundary", "version": "1.0.0"},
    "domain": {
        "system": "low-voltage-pwm-actuator",
        "voltageClass": "12V-training-example",
        "applicability": "generic project-authored PWM command model only"
    },
    "quantity": {"quantityType": "voltage", "unit": "V"},
    "baseline": {"value": round(healthy_average, 3), "label": "healthy PWM average model"},
    "observed": None,
    "comparison": {
        "status": "unavailable",
        "interpretation": "not_available",
        "authoritativeSpecification": False,
        "reason": "The actuator-side PWM path is open; fault-side command voltage is intentionally unavailable and actuator response is not inferred."
    },
    "provenance": {
        "method": "explicit unsupported/open-path boundary from project-authored actuator training profile",
        "sourceType": "project_model",
        "reproducible": True
    }
}

(OUT / "pwm-actuator-short-ground.json").write_text(
    json.dumps(short_artifact, indent=2) + "\n", encoding="utf-8"
)
(OUT / "pwm-actuator-open-command-unavailable.json").write_text(
    json.dumps(open_artifact, indent=2) + "\n", encoding="utf-8"
)

frame = pd.DataFrame([
    {"state": "healthy_pwm_average", "voltage_V": healthy_average},
    {"state": "pwm_short_ground", "voltage_V": short_ground_average}
])
frame.to_csv(OUT / "pwm-actuator-short-ground.csv", index=False)

fig, ax = plt.subplots()
ax.bar(frame["state"], frame["voltage_V"])
ax.set_ylabel("Average command voltage (V)")
ax.set_title("PWM actuator training model")
fig.tight_layout()
fig.savefig(OUT / "pwm-actuator-short-ground.png", dpi=144)
plt.close(fig)

assert np.isclose(healthy_average, 3.6)

print(json.dumps(short_artifact, indent=2))
print(json.dumps(open_artifact, indent=2))

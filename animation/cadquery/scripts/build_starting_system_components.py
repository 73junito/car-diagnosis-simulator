import cadquery as cq
from cadquery import exporters
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "cadquery" / "output" / "starting-system"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = {}

def save(name, solid, component_id, label):
    stl = OUT / f"{name}.stl"
    step = OUT / f"{name}.step"
    exporters.export(solid, str(stl))
    exporters.export(solid, str(step))
    ASSETS[name] = {
        "componentId": component_id,
        "label": label,
        "stl": str(stl.relative_to(ROOT.parent)).replace("\\", "/"),
        "step": str(step.relative_to(ROOT.parent)).replace("\\", "/"),
        "presentationOnly": True,
        "vehicleSpecific": False,
        "engineeringAuthority": False
    }

# Generic starter motor: cylindrical housing, end cap, drive nose, and mounting foot.
motor = cq.Workplane("YZ").circle(30).extrude(78).translate((-39,0,0))
motor = motor.union(cq.Workplane("YZ").circle(23).extrude(18).translate((39,0,0)))
motor = motor.union(cq.Workplane("YZ").circle(8).extrude(105).translate((-52,0,0)))
motor = motor.union(cq.Workplane("XY").box(46,62,10).translate((0,0,-35)))
save("starter-motor-generic", motor, "MTR1", "Generic starter motor")

# Generic solenoid: cylindrical body with two main studs and one control terminal.
sol = cq.Workplane("YZ").circle(18).extrude(52).translate((-26,0,0))
for y in (-10,10):
    sol = sol.union(cq.Workplane("XY").workplane(offset=20).center(12,y).cylinder(10,4))
sol = sol.union(cq.Workplane("XY").workplane(offset=20).center(-10,0).cylinder(8,3))
save("starter-solenoid-generic", sol, "SOL_CONTACT", "Generic starter solenoid")

# Generic start-command switch: compact switch body with actuator and two terminals.
sw = cq.Workplane("XY").box(46,34,18).edges("|Z").fillet(3)
sw = sw.union(cq.Workplane("XY").workplane(offset=11).box(18,12,8))
for x in (-13,13):
    sw = sw.union(cq.Workplane("XY").workplane(offset=-12).center(x,0).box(7,7,8))
save("start-switch-generic", sw, "SW1", "Generic start command switch")

# Generic control protection: fuse/link housing with two studs.
fuse = cq.Workplane("XY").box(48,22,15).edges("|Z").fillet(2)
for x in (-16,16):
    fuse = fuse.union(cq.Workplane("XY").workplane(offset=10).center(x,0).cylinder(8,4))
save("start-control-protection-generic", fuse, "FUSE1", "Generic start-control protection")

manifest = {
    "schemaVersion": "1.0.0",
    "purpose": "deterministic-starting-system-cadquery-intermediates",
    "authoringTool": "CadQuery",
    "governance": {
        "presentationOnly": True,
        "vehicleSpecific": False,
        "engineeringAuthority": False,
        "measurementAuthority": False,
        "publicationAuthority": False
    },
    "assets": ASSETS
}
(OUT / "metadata.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))

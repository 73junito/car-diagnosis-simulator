import cadquery as cq
from cadquery import exporters
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "cadquery" / "output" / "multivoltage"
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

# Generic traction battery pack: enclosure + terminal bosses.
pack = (
    cq.Workplane("XY")
    .box(120, 70, 22)
    .edges("|Z").fillet(4)
)
pos = cq.Workplane("XY").workplane(offset=14).center(-38, 0).cylinder(8, 6)
neg = cq.Workplane("XY").workplane(offset=14).center(38, 0).cylinder(8, 6)
save("traction-battery-generic", pack.union(pos).union(neg), "HVBAT", "Generic traction battery pack")

# Generic DC/DC converter: enclosure + four terminal blocks.
dcdc = cq.Workplane("XY").box(82, 54, 26).edges("|Z").fillet(3)
for x,y in [(-30,18),(-10,18),(10,18),(30,18)]:
    dcdc = dcdc.union(cq.Workplane("XY").workplane(offset=16).center(x,y).box(10,8,8))
save("dcdc-converter-generic", dcdc, "DCDC1", "Generic DC/DC converter")

# Generic inverter: enclosure + DC pair and three motor phase terminals.
inv = cq.Workplane("XY").box(92, 60, 28).edges("|Z").fillet(3)
for x in (-26, 26):
    inv = inv.union(cq.Workplane("XY").workplane(offset=18).center(x,-20).box(12,8,8))
for x in (-28,0,28):
    inv = inv.union(cq.Workplane("XY").workplane(offset=18).center(x,20).cylinder(8,5))
save("traction-inverter-generic", inv, "INV1", "Generic traction inverter")

# Generic traction motor: cylindrical housing, shaft, mounting foot.
motor = cq.Workplane("YZ").circle(34).extrude(70).translate((-35,0,0))
motor = motor.union(cq.Workplane("YZ").circle(9).extrude(100).translate((-50,0,0)))
motor = motor.union(cq.Workplane("XY").box(46,70,10).translate((0,0,-39)))
save("traction-motor-generic", motor, "MOTOR1", "Generic traction motor")

# Generic scan tool: handheld enclosure with display bezel and connector boss.
scan = cq.Workplane("XY").box(68, 42, 14).edges("|Z").fillet(4)
scan = scan.union(cq.Workplane("XY").workplane(offset=9).box(44, 24, 3))
scan = scan.union(cq.Workplane("XY").workplane(offset=-10).center(0, -18).box(18, 8, 8))
save("scan-tool-generic", scan, "tool.scan-tool", "Generic diagnostic scan tool")

# Generic temperature probe: handle, probe shaft, and small connector block.
probe = cq.Workplane("YZ").circle(6).extrude(70).translate((-35,0,0))
probe = probe.union(cq.Workplane("YZ").circle(2.2).extrude(120).translate((35,0,0)))
probe = probe.union(cq.Workplane("XY").box(18, 18, 10).translate((-30,0,0)))
save("temperature-probe-generic", probe, "tool.temperature-probe", "Generic temperature probe")

manifest = {
    "schemaVersion": "1.0.0",
    "purpose": "deterministic-multivoltage-cadquery-intermediates",
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

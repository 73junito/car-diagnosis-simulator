import cadquery as cq
from cadquery import exporters
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "cadquery" / "output" / "circuit"
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

# Generic alternator: cylindrical housing + pulley + mounting ear + B+ boss.
alt = cq.Workplane("YZ").circle(34).extrude(58).translate((-29,0,0))
alt = alt.union(cq.Workplane("YZ").circle(18).extrude(12).translate((29,0,0)))
alt = alt.union(cq.Workplane("XY").box(22,18,12).translate((-10,-34,-22)))
alt = alt.union(cq.Workplane("XY").workplane(offset=31).center(12,18).cylinder(10,5))
save("alternator-generic", alt, "ALT1", "Generic alternator")

# Generic regulator: compact module with two connector bosses.
reg = cq.Workplane("XY").box(66,42,16).edges("|Z").fillet(3)
for x in (-18,18):
    reg = reg.union(cq.Workplane("XY").workplane(offset=11).center(x,14).box(12,8,6))
save("voltage-regulator-generic", reg, "REG1", "Generic voltage regulator")

# Generic main charging protection: fusible-link housing + two studs.
fuse = cq.Workplane("XY").box(54,24,16).edges("|Z").fillet(2)
for x in (-18,18):
    fuse = fuse.union(cq.Workplane("XY").workplane(offset=10).center(x,0).cylinder(8,4))
save("charging-protection-generic", fuse, "FUSE1", "Generic charging protection")

# Generic electrical load: resistive-load enclosure + two terminals.
load = cq.Workplane("XY").box(58,38,24).edges("|Z").fillet(3)
for x in (-16,16):
    load = load.union(cq.Workplane("XY").workplane(offset=15).center(x,12).cylinder(7,4))
save("electrical-load-generic", load, "LOAD1", "Generic electrical load")

manifest = {
    "schemaVersion": "1.0.0",
    "purpose": "deterministic-circuit-lab-cadquery-intermediates",
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

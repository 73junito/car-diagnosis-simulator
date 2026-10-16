"""Generic presentation-only alternator assembly. Dimensions are illustrative millimeters."""
import cadquery as cq
from cadquery import exporters
from pathlib import Path
import json
root=Path(__file__).resolve().parents[2]
out=root/"cadquery"/"output"/"alternator-prototype"
out.mkdir(parents=True,exist_ok=True)
parts={}
def put(name,shape,movable=False):
    exporters.export(shape,str(out/(name+".stl")))
    exporters.export(shape,str(out/(name+".step")))
    parts[name]={"stl":name+".stl","step":name+".step","movable":movable,"engineeringAuthority":False}
# Shaft runs on X. All dimensions are generic illustrative—not vehicle specifications.
put("housing-front",cq.Workplane("YZ").circle(36).circle(15).extrude(22).translate((-23,0,0)))
put("housing-rear",cq.Workplane("YZ").circle(36).circle(15).extrude(22).translate((1,0,0)))
put("rotor-shaft",cq.Workplane("YZ").circle(7).extrude(86).translate((-39,0,0)),True)
put("pulley",cq.Workplane("YZ").circle(25).circle(7).extrude(16).translate((-39,0,0)),True)
put("mounting-ear",cq.Workplane("XY").box(23,22,15).translate((0,-42,-19)))
put("output-stud",cq.Workplane("YZ").circle(4).extrude(17).translate((23,12,14)))
put("plug-connector",cq.Workplane("XY").box(14,11,10).translate((29,-12,13)))
manifest={"schemaVersion":"1.0.0","component":"generic-12v-alternator","units":"illustrative-mm","source":"project-authored-cadquery","meshyReferenceTask":"01a142b8-6fad-70a7-be9a-3e3bdfb571a0","referenceIsEngineeringSource":False,"presentationOnly":True,"engineeringAuthority":False,"measurementAuthority":False,"assessmentAuthority":False,"publicationAuthority":False,"vehicleSpecific":False,"parts":parts,"notes":["The Meshy GLB was used for visual reference only, not dimensional conversion.","Pulley and shaft are named independently; rotation must be controlled by the governed runtime.","Dimensions and terminal locations are placeholders pending technical human review."]}
(out/"metadata.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf8")
print("generated",len(parts),"parts",out)

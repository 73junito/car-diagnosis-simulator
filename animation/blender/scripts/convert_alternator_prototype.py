"""Convert illustrative alternator CadQuery intermediates into a review-only GLB."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root/"cadquery"/"output"/"alternator-prototype"
metadata=json.loads((folder/"metadata.json").read_text(encoding="utf8"))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for name,entry in metadata["parts"].items():
    prior=set(bpy.data.objects)
    bpy.ops.wm.stl_import(filepath=str(folder/entry["stl"]))
    created=[o for o in bpy.data.objects if o not in prior and o.type=="MESH"]
    if len(created)!=1: raise RuntimeError(f"Unexpected import count for {name}")
    o=created[0]
    o.name="ALT1_"+name.replace("-","_")
    o["presentationOnly"]=True
    o["engineeringAuthority"]=False
    o["measurementAuthority"]=False
    o["animationEligible"]=bool(entry["movable"])
    o["vehicleSpecific"]=False
    o["publicationAuthority"]=False
    # STL is dimensionless; model is authored in illustrative millimeters.
    o.scale=(0.001,0.001,0.001)
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action="DESELECT");o.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if entry["movable"]:
        # Shaft X axis is the rotation axis; pivot at geometric central axis.
        from mathutils import Vector
        center=Vector((0,0,0))
        mw=o.matrix_world
        coords=[mw@v.co for v in o.data.vertices]
        mean=sum((v.x for v in coords))/len(coords)
        o.location.x=-mean
        for v in o.data.vertices:v.co.x+=mean
        o["rotationAxis"]="X"
        o["runtimeDrivenOnly"]=True
outfile=folder/"alternator-governed-prototype.glb"
bpy.ops.export_scene.gltf(filepath=str(outfile),export_format="GLB",export_extras=True,export_cameras=False,export_lights=False)
print("REVIEW_GLB",outfile,{"meshObjects":len([o for o in bpy.data.objects if o.type=="MESH"]),"bytes":outfile.stat().st_size})

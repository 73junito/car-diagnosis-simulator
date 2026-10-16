import argparse
import json
from pathlib import Path
import bpy

def parse_args():
    import sys
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--input-dir", required=True)
    p.add_argument("--output-dir", required=True)
    return p.parse_args(argv)

def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)

def import_stl(filepath):
    try:
        bpy.ops.wm.stl_import(filepath=str(filepath))
    except Exception:
        bpy.ops.import_mesh.stl(filepath=str(filepath))
    objs=[o for o in bpy.context.scene.objects if o.type=="MESH"]
    if not objs:
        raise RuntimeError("No mesh imported from " + str(filepath))
    return objs

def main():
    args=parse_args()
    in_dir=Path(args.input_dir)
    out_dir=Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    metadata=json.loads((in_dir/"metadata.json").read_text(encoding="utf-8"))
    exported=[]

    for name, entry in metadata["assets"].items():
        reset_scene()
        stl=in_dir/(Path(entry["stl"]).name)
        objs=import_stl(stl)
        for obj in objs:
            obj["presentationOnly"]=True
            obj["vehicleSpecific"]=False
            obj["engineeringAuthority"]=False
            obj["sourceAuthoringTool"]="CadQuery"
            obj["componentId"]=entry["componentId"]
            obj["trainingRole"]="generic-project-authored-geometry"
        bpy.context.view_layer.objects.active=objs[0]
        for obj in objs:
            obj.select_set(True)

        out=out_dir/(name+".glb")
        bpy.ops.export_scene.gltf(
            filepath=str(out),
            export_format="GLB",
            export_extras=True,
            export_cameras=False,
            export_lights=False,
            use_selection=True
        )
        exported.append({"name":name,"componentId":entry["componentId"],"output":str(out)})

    print(json.dumps({"exported":exported}, indent=2))

if __name__=="__main__":
    main()

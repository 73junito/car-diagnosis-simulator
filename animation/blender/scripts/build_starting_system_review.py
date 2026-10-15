import bpy
import hashlib
import json
import math
import mathutils
import sys
from pathlib import Path

STATUS = "engineering-derived-review-only"

def sha(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1048576),b""): h.update(chunk)
    return h.hexdigest()

def sha_text_canonical(path):
    text=Path(path).read_text(encoding="utf-8")
    canonical=text.replace("\r\n","\n").replace("\r","\n")
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

def opts():
    raw=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    out={}
    i=0
    while i<len(raw):
        if raw[i].startswith("--") and i+1<len(raw): out[raw[i][2:]]=raw[i+1]; i+=2
        else: i+=1
    for k in ("template","manifest","output","metadata","fallback"):
        if not out.get(k): raise SystemExit("Missing --"+k)
    return out

def clean():
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)

def material(name,color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); return m

def box(name,loc,scale,mat,extras):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.active_object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat)
    for k,v in extras.items(): o[k]=v
    return o

def cyl(name,loc,radius,depth,mat,extras,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=depth,location=loc,rotation=rotation)
    o=bpy.context.active_object; o.name=name; o.data.materials.append(mat)
    for k,v in extras.items(): o[k]=v
    return o

def segment(name,a,b,radius,mat,extras):
    vec=mathutils.Vector(b)-mathutils.Vector(a); length=vec.length
    mid=(mathutils.Vector(a)+mathutils.Vector(b))/2
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=radius,depth=length,location=mid)
    o=bpy.context.active_object; o.name=name; o.rotation_mode="QUATERNION"; o.rotation_quaternion=mathutils.Vector((0,0,1)).rotation_difference(vec.normalized()); o.data.materials.append(mat)
    for k,v in extras.items(): o[k]=v
    return o

def positions(template):
    p=template["layout"]["positions"]; xs=[v["x"] for v in p.values()]; ys=[v["y"] for v in p.values()]
    cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2
    return {k:((v["x"]-cx)*0.012,0,(cy-v["y"])*0.012) for k,v in p.items()}

def add_step_animations(manifest):
    scene=bpy.context.scene
    scene.render.fps=24
    scene.frame_start=1
    scene.frame_end=25
    clip_names=[]
    animated_objects=[o for o in scene.objects if o.get("animationComponentId")]
    for step in manifest["steps"]:
        timeline=step.get("timeline") or {}
        if timeline.get("kind")!="clip": raise SystemExit("Animated review step must use clip timeline: "+step["id"])
        clip=next((c for c in manifest["presentation"]["clips"] if c["id"]==timeline.get("clipId")),None)
        if not clip: raise SystemExit("Missing declared clip for step: "+step["id"])
        clip_name=clip["assetClipName"]
        clip_names.append(clip_name)
        highlighted=set(step.get("highlightComponentIds") or [])
        targets=[o for o in animated_objects if o.get("animationComponentId") in highlighted]
        if not targets: raise SystemExit("No Blender objects mapped to highlighted components for step: "+step["id"])
        for obj in targets:
            base=tuple(obj.scale)
            action=bpy.data.actions.new(clip_name+"__"+obj.name)
            obj.animation_data_create()
            obj.animation_data.action=action
            obj.scale=base
            obj.keyframe_insert(data_path="scale",frame=1)
            obj.scale=tuple(v*1.06 for v in base)
            obj.keyframe_insert(data_path="scale",frame=13)
            obj.scale=base
            obj.keyframe_insert(data_path="scale",frame=25)
            obj.animation_data.action=None
            track=obj.animation_data.nla_tracks.new()
            track.name=clip_name
            track.strips.new(action.name,1,action)
    return clip_names

def svg(template,path):
    pos=template["layout"]["positions"]; comps={c["id"]:c for c in template["components"]}
    owner={t["id"]:c["id"] for c in template["components"] for t in c["terminals"]}
    colors={"power_feed":"#9b2c2c","ground_reference":"#334155","control":"#1d4ed8"}
    s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 650" role="img" aria-labelledby="title desc">','<title id="title">Generic 12 V starting-system voltage-drop review fallback</title>','<desc id="desc">Non-vehicle-specific starting-system relationships and voltage-drop test points.</desc>','<rect width="820" height="650" fill="#f8fafc"/>']
    for c in template["connections"]:
        a=pos[owner[c["from"]]]; b=pos[owner[c["to"]]]; color=colors.get(c["type"],"#64748b")
        s.append(f'<line x1="{a["x"]}" y1="{a["y"]}" x2="{b["x"]}" y2="{b["y"]}" stroke="{color}" stroke-width="5"/>')
    for cid,p in pos.items():
        s.append(f'<rect x="{p["x"]-55}" y="{p["y"]-28}" width="110" height="56" rx="10" fill="white" stroke="#334155" stroke-width="2"/>')
        s.append(f'<text x="{p["x"]}" y="{p["y"]+4}" text-anchor="middle" font-family="Arial" font-size="12">{comps[cid]["name"]}</text>')
    for tp in template["testPoints"]:
        p=pos[owner[tp["terminalId"]]]
        s.append(f'<circle cx="{p["x"]+42}" cy="{p["y"]-36}" r="8" fill="#facc15" stroke="#713f12" stroke-width="2"/>')
    s.append('<text x="410" y="625" text-anchor="middle" font-family="Arial" font-size="13" fill="#475569">Generic training relationships only — vehicle-specific service information is required for actual wiring, procedures, specifications, and limits.</text>')
    s.append('</svg>'); path.write_text("\n".join(s)+"\n",encoding="utf-8")

def main():
    o=opts(); tp=Path(o["template"]).resolve(); mp=Path(o["manifest"]).resolve(); out=Path(o["output"]).resolve(); meta=Path(o["metadata"]).resolve(); fb=Path(o["fallback"]).resolve()
    template=json.loads(tp.read_text(encoding="utf-8")); manifest=json.loads(mp.read_text(encoding="utf-8"))
    if template["vehicleApplicability"]["vehicleSpecific"] is not False: raise SystemExit("Template must remain generic")
    if manifest["governance"]["publicationAllowed"] is not False: raise SystemExit("Review manifest cannot publish")
    clean()
    scene=bpy.context.scene; scene["alpAnimationId"]=manifest["animationId"]; scene["alpAssetStatus"]=STATUS; scene["alpVehicleSpecific"]=False; scene["alpPublicationAllowed"]=False; scene["alpAssessmentEligible"]=False; scene["alpEngineeringTemplateId"]=template["templateId"]
    mats={"component":material("component",(0.30,0.42,0.55)),"control":material("control",(0.20,0.45,0.75)),"switch":material("switch",(0.36,0.55,0.42)),"ground":material("ground",(0.25,0.29,0.34)),"power":material("power",(0.66,0.24,0.24)),"test":material("test",(0.95,0.72,0.12)),"meter":material("meter",(0.12,0.16,0.22))}
    pos=positions(template)
    amap={"BAT1":"battery","FUSE1":"control-protection","SW1":"start-command-switch","SOL_COIL":"starter-solenoid-coil","SOL_CONTACT":"starter-solenoid-contact","MTR1":"starter-motor","GND1":"ground-path"}
    for c in template["components"]:
        x,y,z=pos[c["id"]]; extras={"animationComponentId":amap[c["id"]],"engineeringComponentId":c["id"],"engineeringType":c["type"],"assetStatus":STATUS}
        if c["id"]=="MTR1": cyl(amap[c["id"]],(x,y,z),0.48,1.15,mats["component"],extras,(0,math.radians(90),0))
        elif c["id"]=="SOL_COIL": cyl(amap[c["id"]],(x,y,z),0.35,0.8,mats["control"],extras,(math.radians(90),0,0))
        else: box(amap[c["id"]],(x,y,z),(0.55,0.28,0.35),mats["control"] if c["id"] in ("FUSE1","SW1") else (mats["switch"] if c["id"]=="SOL_CONTACT" else (mats["ground"] if c["id"]=="GND1" else mats["component"])),extras)
    owner={t["id"]:c["id"] for c in template["components"] for t in c["terminals"]}
    for c in template["connections"]:
        kind="ground" if c["type"]=="ground_reference" else ("control" if c["type"]=="control" else "power")
        anim="ground-path" if kind=="ground" else ("positive-path" if kind=="power" else "starter-solenoid-coil")
        segment("path-"+c["id"].lower(),pos[owner[c["from"]]],pos[owner[c["to"]]],0.045,mats["ground"] if kind=="ground" else (mats["control"] if kind=="control" else mats["power"]),{"animationComponentId":anim,"engineeringConnectionId":c["id"],"connectionType":c["type"],"assetStatus":STATUS})
    for tpnt in template["testPoints"]:
        x,y,z=pos[owner[tpnt["terminalId"]]]
        cyl("test-point-"+tpnt["id"].lower(),(x+0.55,y,z+0.55),0.10,0.08,mats["test"],{"testPointId":tpnt["id"],"engineeringTerminalId":tpnt["terminalId"],"measurementTypes":",".join(tpnt["measurementTypes"]),"vehicleSpecificValueRequired":bool(tpnt["vehicleSpecificValueRequired"]),"assetStatus":STATUS},(math.radians(90),0,0))
    mx=max(v[0] for v in pos.values())+1.5; mz=sum(v[2] for v in pos.values())/len(pos)
    box("digital-multimeter",(mx,0,mz),(0.48,0.20,0.68),mats["meter"],{"animationComponentId":"digital-multimeter","instructionalOverlay":True,"engineeringComponent":False,"assetStatus":STATUS})
    clip_names=add_step_animations(manifest)
    out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out),export_format="GLB",use_selection=False,export_apply=True,export_animations=True,export_animation_mode="NLA_TRACKS",export_merge_animation="NLA_TRACK",export_cameras=False,export_lights=False,export_extras=True)
    svg(template,fb)
    md={"schemaVersion":"1.0.0","animationId":manifest["animationId"],"assetStatus":STATUS,"classification":"engineering-derived","vehicleSpecificClaims":False,"publicationAllowed":False,"assessmentEligible":False,"scoredAssessmentApproved":False,"humanApprovalRequired":True,"agentMayApprove":False,"agentMayRelease":False,"engineeringTemplateId":template["templateId"],"engineeringTemplateSha256":sha(tp),"manifestSha256":sha_text_canonical(mp),"generatorScriptSha256":sha(Path(__file__).resolve()),"blenderVersion":".".join(str(v) for v in bpy.app.version),"outputSha256":sha(out),"outputBytes":out.stat().st_size,"fallbackSha256":sha_text_canonical(fb),"presentationMode":manifest["presentation"]["mode"],"animationClipNames":clip_names,"animationClipCount":len(clip_names),"componentMappings":{"battery":"BAT1","control-protection":"FUSE1","start-command-switch":"SW1","starter-solenoid-coil":"SOL_COIL","starter-solenoid-contact":"SOL_CONTACT","starter-motor":"MTR1","ground-path":"GND1"},"connectionDerivedComponents":["positive-path","ground-path"],"instructionalOverlays":["digital-multimeter"],"testPointIds":[x["id"] for x in template["testPoints"]],"operatingStateIds":[x["id"] for x in template["operatingStates"]],"faultIds":[x["id"] for x in template["faultCatalog"]],"numericPolicy":"No vehicle-specific acceptable measurement or limit is embedded in the 3D review asset.","textHashPolicy":"sha256-utf8-lf-normalized"}
    meta.write_text(json.dumps(md,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print("ANIM1D_SHA256="+md["outputSha256"])

if __name__=="__main__": main()

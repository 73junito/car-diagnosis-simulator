import bpy
import hashlib
import json
import math
import os
import sys
from pathlib import Path

PIPELINE_VERSION = "1.0.0"
GENERATOR_KIND = "AutoLearnPro ANIM-1C pipeline-validation proxy"

def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def parse_args(argv):
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    parsed = {}
    i = 0
    while i < len(args):
        token = args[i]
        if token.startswith("--") and i + 1 < len(args):
            parsed[token[2:]] = args[i + 1]
            i += 2
        else:
            i += 1
    for required in ("manifest", "output", "metadata"):
        if not parsed.get(required):
            raise SystemExit("Missing required argument --" + required)
    return parsed

def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)

def add_proxy_component(component, index, total):
    # Deterministic proxy geometry only. This is not an engineering representation.
    cols = max(1, math.ceil(math.sqrt(total)))
    row = index // cols
    col = index % cols
    x = (col - (cols - 1) / 2.0) * 2.2
    y = (row - (math.ceil(total / cols) - 1) / 2.0) * 2.2
    z = 0.0
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = component["id"]
    obj["animationComponentId"] = component["id"]
    obj["componentLabel"] = component["label"]
    obj["alpPurpose"] = "pipeline-validation-proxy"
    scale_z = 0.65 + (index % 3) * 0.12
    obj.scale = (0.8, 0.8, scale_z)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj

def main():
    opts = parse_args(sys.argv)
    manifest_path = Path(opts["manifest"]).resolve()
    output_path = Path(opts["output"]).resolve()
    metadata_path = Path(opts["metadata"]).resolve()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    governance = manifest.get("governance", {})
    if governance.get("assessmentEligible") is not False or governance.get("scoredAssessmentApproved") is not False:
        raise SystemExit("Manifest violates ANIM assessment boundary")
    if governance.get("agentMayApprove") is not False or governance.get("agentMayRelease") is not False:
        raise SystemExit("Manifest violates ANIM agent-approval boundary")

    components = manifest.get("components") or []
    if not components:
        raise SystemExit("Manifest contains no components")

    clean_scene()
    scene = bpy.context.scene
    scene["alpAnimationId"] = manifest["animationId"]
    scene["alpClassification"] = manifest["classification"]
    scene["alpAssetStatus"] = "pipeline-validation-only"
    scene["alpMayPublish"] = False
    scene["alpAssessmentEligible"] = False
    scene["alpGeneratorKind"] = GENERATOR_KIND

    for index, component in enumerate(components):
        add_proxy_component(component, index, len(components))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_animations=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )

    script_path = Path(__file__).resolve()
    metadata = {
        "schemaVersion": PIPELINE_VERSION,
        "animationId": manifest["animationId"],
        "classification": manifest["classification"],
        "assetStatus": "pipeline-validation-only",
        "mayPublish": False,
        "mayAttachToProductionLesson": False,
        "assessmentEligible": False,
        "scoredAssessmentApproved": False,
        "humanApprovalRequired": True,
        "agentMayApprove": False,
        "agentMayRelease": False,
        "manifestSha256": sha256_file(manifest_path),
        "generatorScriptSha256": sha256_file(script_path),
        "blenderVersion": ".".join(str(v) for v in bpy.app.version),
        "outputSha256": sha256_file(output_path),
        "outputBytes": output_path.stat().st_size,
        "componentIds": [component["id"] for component in components],
        "generatedAtPolicy": "not-recorded-in-deterministic-sidecar",
        "generatorKind": GENERATOR_KIND,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ANIM1C_OUTPUT=" + str(output_path))
    print("ANIM1C_SHA256=" + metadata["outputSha256"])
    print("ANIM1C_METADATA=" + str(metadata_path))

if __name__ == "__main__":
    main()

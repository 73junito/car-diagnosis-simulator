import argparse
import json
import math
import re
from pathlib import Path
from xml.etree import ElementTree as ET

import cadquery as cq
import ezdxf

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
TOKEN_RE = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")

def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))

def pairs(values):
    return [(float(values[i]), float(values[i + 1])) for i in range(0, len(values), 2)]

def sample_path(d, curve_steps=12):
    tokens = TOKEN_RE.findall(d)
    i = 0
    cmd = None
    current = (0.0, 0.0)
    start = None
    last_control = None
    polylines = []
    points = []

    def flush():
        nonlocal points
        if len(points) > 1:
            polylines.append(points)
        points = []

    def append(point):
        nonlocal current
        current = point
        if not points or points[-1] != point:
            points.append(point)

    def number():
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i].upper()
            i += 1
            if cmd == "Z":
                if start:
                    append(start)
                flush()
                continue

        if cmd == "M":
            flush()
            point = (number(), number())
            append(point)
            start = point
            cmd = "L"
            last_control = None
        elif cmd == "L":
            append((number(), number()))
            last_control = None
        elif cmd == "H":
            append((number(), current[1]))
            last_control = None
        elif cmd == "V":
            append((current[0], number()))
            last_control = None
        elif cmd == "C":
            p0 = current
            p1 = (number(), number())
            p2 = (number(), number())
            p3 = (number(), number())
            for step in range(1, curve_steps + 1):
                t = step / curve_steps
                mt = 1 - t
                append((
                    mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0],
                    mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1],
                ))
            last_control = p2
        elif cmd == "S":
            p0 = current
            p1 = (2*p0[0] - last_control[0], 2*p0[1] - last_control[1]) if last_control else p0
            p2 = (number(), number())
            p3 = (number(), number())
            for step in range(1, curve_steps + 1):
                t = step / curve_steps
                mt = 1 - t
                append((
                    mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0],
                    mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1],
                ))
            last_control = p2
        elif cmd == "Q":
            p0 = current
            p1 = (number(), number())
            p2 = (number(), number())
            for step in range(1, curve_steps + 1):
                t = step / curve_steps
                mt = 1 - t
                append((
                    mt**2*p0[0] + 2*mt*t*p1[0] + t**2*p2[0],
                    mt**2*p0[1] + 2*mt*t*p1[1] + t**2*p2[1],
                ))
            last_control = p1
        else:
            raise ValueError(f"Unsupported SVG path command: {cmd}")
    flush()
    return polylines

def add_svg_primitive(parent, primitive):
    attrs = {str(k): str(v) for k, v in primitive.get("attrs", {}).items()}
    if primitive.get("className"):
        attrs["class"] = primitive["className"]
    node = ET.SubElement(parent, f"{{{SVG_NS}}}{primitive['type']}", attrs)
    if primitive.get("text"):
        node.text = primitive["text"]

def export_svg(symbol, output):
    svg = ET.Element(f"{{{SVG_NS}}}svg", {
        "viewBox": "0 0 100 100", "width": "100", "height": "100",
        "role": "img", "aria-label": symbol["name"]
    })
    style = ET.SubElement(svg, f"{{{SVG_NS}}}style")
    style.text = ".symbol-stroke{fill:none;stroke:#111827;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.symbol-fill{fill:#fff;stroke:#111827;stroke-width:3}.symbol-solid{fill:#111827;stroke:#111827;stroke-width:2}.symbol-fluid{stroke:#2563eb;stroke-width:3}.symbol-text{fill:#111827;font:700 24px sans-serif;text-anchor:middle}"
    for primitive in symbol["primitives"]:
        add_svg_primitive(svg, primitive)
    ET.ElementTree(svg).write(output, encoding="utf-8", xml_declaration=True)

def add_dxf_primitive(msp, primitive):
    kind = primitive["type"]
    a = primitive.get("attrs", {})
    if kind == "line":
        msp.add_line((a["x1"], -a["y1"]), (a["x2"], -a["y2"]))
    elif kind == "rect":
        x, y, w, h = a["x"], a["y"], a["width"], a["height"]
        msp.add_lwpolyline([(x,-y),(x+w,-y),(x+w,-y-h),(x,-y-h),(x,-y)], close=True)
    elif kind == "circle":
        msp.add_circle((a["cx"], -a["cy"]), a["r"])
    elif kind == "ellipse":
        msp.add_ellipse((a["cx"], -a["cy"]), major_axis=(a["rx"],0), ratio=a["ry"]/a["rx"])
    elif kind in ("polyline", "polygon"):
        pts = pairs(re.findall(r"[-+]?\d*\.?\d+", a["points"]))
        pts = [(x,-y) for x,y in pts]
        msp.add_lwpolyline(pts, close=(kind == "polygon"))
    elif kind == "path":
        for pts in sample_path(a["d"]):
            msp.add_lwpolyline([(x,-y) for x,y in pts])
    elif kind == "text":
        text = primitive.get("text", "")
        entity = msp.add_text(text, dxfattribs={"height": 8})
        entity.set_placement((a.get("x", 50), -a.get("y", 50)))
    else:
        raise ValueError(f"Unsupported primitive for DXF: {kind}")

def export_dxf(symbol, output):
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    for primitive in symbol["primitives"]:
        add_dxf_primitive(msp, primitive)
    doc.header["$INSUNITS"] = 0
    doc.saveas(output)

def main():
    parser = argparse.ArgumentParser(description="Export TorqueMind project-authored symbol catalogs to SVG and DXF.")
    parser.add_argument("--root", default=".")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    data = root / "data" / "symbols"
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    manifest = read_json(data / "manifest.json")
    count = 0
    for domain in manifest["domains"]:
        catalog = read_json(data / domain["file"])
        domain_out = out / domain["id"]
        domain_out.mkdir(parents=True, exist_ok=True)
        for symbol in catalog["symbols"]:
            base = symbol["id"].split(".", 1)[1]
            export_svg(symbol, domain_out / f"{base}.svg")
            export_dxf(symbol, domain_out / f"{base}.dxf")
            count += 1
    (out / "export-manifest.json").write_text(json.dumps({
        "symbolCount": count,
        "formats": ["svg", "dxf"],
        "logicalGrid": [100,100],
        "cadqueryVersion": getattr(cq, "__version__", "unknown"),
        "ezdxfVersion": ezdxf.__version__
    }, indent=2), encoding="utf-8")
    print(f"Exported {count} symbols to SVG and DXF using CadQuery environment.")

if __name__ == "__main__":
    main()

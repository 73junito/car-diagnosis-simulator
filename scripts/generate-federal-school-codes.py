import hashlib
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXPECTED_HEADERS = [
    "SchoolCode", "SchoolName", "Address", "City", "StateCode",
    "ZipCode", "Province", "Country", "PostalCode",
]

def col_index(ref):
    letters = "".join(ch for ch in ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch.upper()) - 64)
    return value - 1

def read_xlsx(path):
    with zipfile.ZipFile(path) as zf:
        shared = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(t.text or "" for t in item.iterfind(".//m:t", NS)))
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            values = [""] * 9
            for cell in row.findall("m:c", NS):
                idx = col_index(cell.attrib.get("r", "A1"))
                if idx >= 9:
                    continue
                kind = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                value = value_node.text if value_node is not None else ""
                if kind == "s" and value:
                    value = shared[int(value)]
                elif kind == "inlineStr":
                    text_node = cell.find("m:is/m:t", NS)
                    value = text_node.text if text_node is not None else ""
                values[idx] = value
            rows.append(values)
        return rows

def clean(value):
    return str(value or "").strip()

def sql_literal(value):
    value = clean(value)
    if not value:
        return "null"
    return "'" + value.replace("'", "''") + "'"
def build_rows(rows):
    if rows[0] != EXPECTED_HEADERS:
        raise SystemExit(f"Unexpected headers: {rows[0]}")
    records = []
    for row in rows[1:]:
        code = clean(row[0]).upper()
        if not code:
            continue
        if len(code) != 6 or not code.isalnum():
            raise SystemExit(f"Invalid school code: {code}")
        records.append([
            code,
            clean(row[1]),
            clean(row[2]),
            clean(row[3]),
            clean(row[4]),
            clean(row[5]),
            clean(row[6]),
            clean(row[7]),
            clean(row[8]),
        ])
    if len(records) != 6547:
        raise SystemExit(f"Expected 6547 institutions; found {len(records)}")
    if len({row[0] for row in records}) != 6547:
        raise SystemExit("Duplicate school codes found")
    return records

def render_batch(batch):
    values = []
    for row in batch:
        cols = ", ".join(sql_literal(value) for value in row)
        values.append(
            f"({cols}, 'Federal School Code List', '2026-27 4th Quarter', true)"
        )
    return (
        "insert into public.institutions (\n"
        "  school_code, school_name, address, city, state_code, zip_code,\n"
        "  province, country, postal_code, source_name, source_period, active\n"
        ") values\n"
        + ",\n".join(values)
        + "\non conflict (school_code) do update set\n"
        "  school_name = excluded.school_name,\n"
        "  address = excluded.address,\n"
        "  city = excluded.city,\n"
        "  state_code = excluded.state_code,\n"
        "  zip_code = excluded.zip_code,\n"
        "  province = excluded.province,\n"
        "  country = excluded.country,\n"
        "  postal_code = excluded.postal_code,\n"
        "  source_name = excluded.source_name,\n"
        "  source_period = excluded.source_period,\n"
        "  active = excluded.active,\n"
        "  updated_at = now();\n"
    )

def render_sql(records, source_hash):
    parts = [
        "-- Generated from 2026-27 Federal School Code List, 4th Quarter.",
        "-- Server-side institution directory seed; never copied to static assets.",
        f"-- record-count: {len(records)}",
        f"-- source-sha256: {source_hash}",
        "",
    ]
    for start in range(0, len(records), 250):
        parts.append(render_batch(records[start:start + 250]))
    return "\n".join(parts) + "\n"

def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "usage: generate-federal-school-codes.py INPUT.xlsx OUTPUT.sql"
        )

    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    records = build_rows(read_xlsx(source))

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        render_sql(records, source_hash),
        encoding="utf-8",
        newline="\n",
    )
    print(
        f"generated {target} with {len(records)} institutions "
        f"from sha256 {source_hash}"
    )

if __name__ == "__main__":
    main()

# Standardized Schematic Symbol Library

## Purpose

This library is the canonical source for reusable TorqueMind/AutoLearnPro schematic symbols. It separates symbol identity and geometry from any individual simulator or lesson so electrical, hydraulic, pneumatic, mechanical, and thermal diagrams can reuse the same definitions.

## Current catalog

| Domain | Initial symbols | Reference family |
| --- | ---: | --- |
| Electrical | 10 | IEC 60617:2026 DB; ISO 14617-1:2025 |
| Hydraulic | 11 | ISO 1219-1:2012 + Amd 1:2016; ISO 14617-1:2025 |
| Pneumatic | 11 | ISO 1219-1:2012 + Amd 1:2016; ISO 14617-1:2025 |
| Mechanical | 8 | ISO 14617-1:2025 |
| Thermal | 6 | ISO 14617-1:2025 |

Total initial catalog: **46 symbols**.

## Canonical representation

Every symbol uses a 100 x 100 logical coordinate grid and contains:

- globally unique `domain.symbol-name` identifier;
- human-readable name, optional aliases, and search tags;
- explicit terminals with normalized coordinates;
- renderer-neutral drawing primitives;
- project status and standards-family references at catalog level.

The JSON definitions under `data/symbols/` are the source of truth. Web SVG, DXF, and future renderers are derived outputs.
## Standards and rights boundary

The library is **project-authored and reference-aligned**. It does not copy or redistribute proprietary IEC/ISO graphical artwork, reference-number tables, application notes, or database content.

A standards-family reference means the project intends to use that standard as a technical review target. It does **not** mean the symbol has been independently certified as conforming to that standard.

Before a symbol is represented publicly as standards-conforming, it requires a documented technical review against legally accessible authoritative source material.

## Validation

Run:

```powershell
npm run validate:symbol-library
```

The validator checks domain names, unique IDs, required primitives, terminal coordinates, catalog/reference metadata, and the 100 x 100 coordinate contract.

## CAD export

The exporter generates one SVG and one DXF per canonical definition.

For Rafael's local CadQuery environment:

```powershell
& "C:\Users\rod63\miniforge3\envs\cadquery\python.exe" `
  scripts\symbols\export_symbol_library.py `
  --root . `
  --out "F:\TorqueMind-symbol-library-export"
```

The exporter records the active CadQuery and ezdxf versions in `export-manifest.json`. Generated output is derivative and should not replace the canonical JSON definitions.

## Integration rule

New simulators should request a symbol by library ID rather than embed custom symbol geometry. If a needed symbol does not exist, add and validate it in this library first, then consume it from the simulator.

The existing Circuit Lab should be migrated to this library only after the library branch is reviewed and accepted.

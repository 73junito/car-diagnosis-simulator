# Standardized Schematic Symbol Library

## Purpose

This library is the canonical source for reusable TorqueMind/AutoLearnPro schematic symbols. It separates symbol identity and geometry from any individual simulator or lesson so electrical, hydraulic, pneumatic, mechanical, and thermal diagrams can reuse the same definitions.

## Current catalog

| Domain | Symbols | Reference family |
| --- | ---: | --- |
| Electrical | 30 | IEC 60617:2026 DB; ISO 14617-1:2025 |
| Hydraulic | 11 | ISO 1219-1:2012 + Amd 1:2016; ISO 14617-1:2025 |
| Pneumatic | 11 | ISO 1219-1:2012 + Amd 1:2016; ISO 14617-1:2025 |
| Mechanical | 8 | ISO 14617-1:2025 |
| Thermal | 6 | ISO 14617-1:2025 |

Current catalog: **66 symbols**.

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

The production Circuit Lab consumes this library directly. New labs must use the same library-first integration rule.

## Electrical connection styles

Electrical conductors are defined separately from component geometry in `data/connections/electrical.json`. Each connection style has a stable identifier, semantic connection type, visual role, line width, dash pattern, and an explicit rule for whether a voltage system must be declared.

The current catalog includes power, switched power, ground return, control, analog signal, digital signal, CAN, LIN, PWM, shield/drain, and traction-power styles. These are TorqueMind training conventions and do not represent manufacturer wire-color codes.

Circuit definitions reference connection styles by `styleId` and reference their declared electrical domain by `voltageSystemId`.

## Voltage-domain rules

Every electrical circuit must declare one or more voltage systems. Conventional 12 V circuits must explicitly declare a 12 V nominal system. Hybrid, plug-in hybrid, battery-electric, fuel-cell, 24 V, 48 V, and other architectures must state their actual nominal voltage system or systems rather than inheriting a default.

The voltage-domain renderer distinguishes 12 V, 24 V, 48 V, traction, and other explicitly declared voltage systems visually while keeping the written nominal voltage visible. Visual treatment never substitutes for the voltage label.

For electrified vehicles with multiple electrical domains, each component and conductor references the voltage system to which it belongs.

## Reusable circuit templates

Reusable training circuits live under `data/circuit-templates/`. A template is a complete, validated training definition rather than a page-specific drawing. Each template must declare:

- `templateId`, `templateVersion`, `templateRole`, and `systemKind`
- explicit voltage system(s)
- standardized component `symbolId` values
- per-terminal `symbolTerminalId` mappings
- standardized connection `styleId` and `voltageSystemId`
- operating states and conceptual current-flow groups
- fault catalog and test points
- layout and external-label metadata
- the generic-training / vehicle-specific evidence boundary

The first reusable template is `automotive-12v-starting-system`. It models a protected start-command path, starter-solenoid actuator and main switching contact, starter motor, and engine/chassis return in a conventional **12 V nominal** training system. Exact vehicle wiring, protection strategy, terminal designations, procedures, and specifications remain vehicle-specific.

### 12 V relay-controlled load template

The reusable template `automotive-12v-relay-controlled-load` separates a protected control branch from a separately protected load branch. The control switch energizes a relay coil; the relay''s normally open contact then permits current through the load branch.

The template declares 12 V nominal explicitly and uses standardized symbol, terminal, connection-style, and voltage-system identifiers. It is intentionally generic so it can support later training examples for lamps, pumps, horns, fans, and similar loads without implying manufacturer-specific wiring.

Faults are modeled independently on the control and load sides so learners can distinguish loss of relay command from loss or degradation of switched load current.

### 12 V three-wire powered sensor template

The reusable template `automotive-12v-three-wire-sensor` models a conventional **12 V nominal** vehicle electrical system with a separate **5 V nominal training reference** for a common three-wire powered-sensor example.

The controller and reference-supply components remain part of the 12 V vehicle domain, while the sensor supply and analog signal are explicitly associated with the 5 V training-reference domain. The 5 V value is a training example only and is not a universal sensor specification.

The template separates sensor supply, analog signal, and sensor ground/reference paths and includes open-circuit, high-resistance, short-to-ground, and short-to-reference faults. Short faults are represented as explicit unintended adjacency edges in the circuit engine rather than display-only annotations.

### 12 V PWM-controlled actuator template

The reusable template `automotive-12v-pwm-actuator` models a conventional **12 V nominal** actuator circuit with separate actuator power, PWM command, and ground/return paths.

A dedicated three-wire actuator symbol exposes explicit `power`, `control`, and `ground` terminals so the schematic does not overload a two-terminal solenoid or motor symbol. The controller''s PWM output is represented independently from the actuator power feed.

The operating states use qualitative **low-duty training example** and **high-duty training example** labels. No universal duty-cycle percentage, frequency, current, or response characteristic is asserted. Vehicle-specific values remain intentionally omitted.

The template includes open-circuit, high-resistance, short-to-ground, and short-to-power faults for both load and PWM control paths.

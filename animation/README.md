# AutoLearnPro Governed Animation Foundation (ANIM-1A)

ANIM-1A defines the contract for instructional animation artifacts before any Three.js player, Blender automation, or production animation is introduced.

## Boundary

This phase adds manifest structure, deterministic validation, governance rules, accessibility requirements, and one draft starting-system manifest.

It does not add a 3D runtime, Blender execution, generated media, assessment scoring, assessment eligibility, exam release, or autonomous publication.

## Governance model

Animation artifacts are draft-first and fail closed. Agents may prepare artifacts, but may not approve or release them. A manifest can only claim publication permission after the existing human-review chain reaches final_content_approved and explicit human approval is recorded.

All ANIM-1A artifacts remain assessmentEligible false and scoredAssessmentApproved false.

Vehicle-specific claims require approved evidence references. Engineering-derived animations require at least one engineering artifact reference. Conceptual animations must remain explicitly non-vehicle-specific.

## Required accessibility contract

Every interactive animation manifest requires keyboard operation, reduced-motion behavior, a static fallback, and a text alternative. Runtime implementation arrives in a later phase.

## Files

- schemas/animation-manifest.schema.json — machine-readable manifest schema.
- animation/manifests/*.json — governed animation definitions.
- scripts/verify-animation-manifests.js — deterministic fail-closed validator.
- tests/animation-governance-foundation.test.js — regression coverage.

## Next phases

- ANIM-1B: Three.js browser player and accessible controls.
- ANIM-1C: Blender 5.2 Python asset/export pipeline.
- ANIM-1D: starting-system voltage-drop instructional model.
- ANIM-1E: governed agentic preparation workflow.

No later phase may bypass evidence, rights, technical review, instructional review, or explicit human approval.


## ANIM-1B runtime

The reusable browser player lives under theme/components/animation-player/.

ANIM-1B adds Three.js as the only 3D runtime dependency. The static build packages a minimal same-origin vendor surface from the installed MIT-licensed three package: the core ES module, GLTFLoader, OrbitControls, required loader utilities, and the upstream license. No CDN or remote script origin is required.

The player is fail-closed by default. Draft manifests are not rendered unless a caller explicitly opts into allowDraft for development or review. Published interactive 3D manifests must have final human approval, publication permission, a deployable model asset, and a static fallback.

ANIM-1B does not attach an animation to any production lesson and does not change scoring, grading, assessment eligibility, exam release, authentication, authorization, or curriculum governance.


## ANIM-1C Blender pipeline

ANIM-1C adds a deterministic headless Blender 5.2+ export pipeline. The Node runner discovers Blender through BLENDER_EXE or standard installation paths and invokes Blender with --background --factory-startup.

The first generator creates only deterministic proxy component geometry for pipeline validation. Proxy outputs are marked pipeline-validation-only, cannot be published or attached to a production lesson, remain assessment-ineligible, and require human approval before any later instructional use.

Generated GLB and sidecar metadata under animation/blender/output are intentionally ignored by Git. The deterministic sidecar omits wall-clock timestamps and records manifest/script/output SHA-256 values, Blender version, component IDs, output size, and governance boundaries.

Local validation commands:
- npm run validate:animation-blender
- npm run validate:animation-cadquery
- npm run doctor:animation-cadquery
- npm run build:animation-proxy

### CadQuery geometry-authoring stage

CadQuery is an upstream parametric-CAD authoring stage for the governed 3D asset pipeline. It may create deterministic project-authored geometry and STEP/STL intermediates, but it does not gain engineering, measurement, assessment, publication, or release authority. Governed GLB export/review remains downstream in the Blender pipeline.

Environment discovery is portable and ordered:
1. `CADQUERY_PYTHON` may point directly to a Python interpreter.
2. `CADQUERY_ENV` may point to the CadQuery environment root.
3. On Windows, the resolver checks `%USERPROFILE%\miniforge3\envs\cadquery\python.exe`.
4. An active Conda environment named `cadquery` may be used.

On the current Windows workstation, the USERPROFILE-relative path resolves to `C:\Users\rod63\miniforge3\envs\cadquery`. The personal user name is intentionally not hardcoded in executable pipeline logic.

Use `npm run doctor:animation-cadquery` for a local import/version check. CI validates the pipeline contract but does not require the workstation-specific environment to exist.

ANIM-1D will replace proxy geometry with the first governed starting-system instructional model. ANIM-1C itself does not make vehicle-specific claims and does not alter lesson delivery, scoring, grading, assessment eligibility, exam release, authentication, authorization, RLS, or curriculum.


## ANIM-1D starting-system review model

ANIM-1D adds the first engineering-derived 3D instructional review asset for the generic 12 V starting system. The model is generated directly from data/circuit-templates/12v-starting-system.json: component placement comes from its layout, conductor relationships come from its connections, test-point markers come from its test-point declarations, and the component identity mapping is recorded in a deterministic metadata sidecar.

The digital multimeter is explicitly classified as an instructional overlay rather than an engineering-template vehicle component.

The review GLB, fallback SVG, metadata sidecar, and review manifest are committed for human technical and instructional review but are deliberately excluded from the static production deployment. The production-facing foundation manifest remains unchanged and unpublished.

The review asset contains no vehicle-specific acceptable measurements, limits, wiring, pinouts, or procedures. Numeric interpretation remains delegated to separately applicable engineering or evidence artifacts and human review.

Commands:
- npm run build:animation-starting-review
- npm run validate:animation-starting-review

## ANIM-1E governed agentic preparation

ANIM-1E lets governed animation agents prepare deterministic human-review handoff packets from an existing animation manifest and its bound engineering/evidence artifacts. Preparation is read-only with respect to source manifests and records canonical source hashes, component/step identities, current governance state, and every unresolved human gate.

Generated packets live under animation/agentic-prep/output/, are gitignored, and are not copied into the static deployment. Agents cannot use this workflow to record human approval, permit publication, change assessment eligibility, enable scored delivery, alter authentication/RLS, or release content.

Commands:
- npm run prepare:animation-agent-review
- npm run validate:animation-agentic-prep

## ANIM-2A student-lab source of truth

ANIM-2A establishes the governed animation manifest/player/runtime stack as the single source of truth for all new student-lab instructional animation work.

Authoritative layers:
- schemas/animation-manifest.schema.json
- animation/manifests/*.json
- theme/components/animation-player/animation-player.js
- theme/components/animation-player/three-runtime.js
- theme/components/animation-player/animation-player.css
- animation/blender/*
- data/architecture/student-lab-animation-source-of-truth.json

Legacy per-lab CSS/SVG motion may remain temporarily as a static/2D fallback during migration, but it is not an authoritative animation source and must not become a parallel animation architecture.

The Starting System Lab is the first integration target. Its current review model remains fail-closed: no production 3D publication occurs until the manifest reaches final_content_approved, explicit human approval is recorded, publicationAllowed is true, and all existing accessibility/governance constraints pass. ANIM-2A does not alter assessment eligibility, scored assessment approval, authentication, authorization, RLS, curriculum eligibility, or any engineering limit.

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

# Diagnostic Question Authoring Workspace — developmental prototype

Separate instructor-oriented **offline** draft page. Open `index.html` for a stand-alone prototype; this route is not connected to the authenticated instructor dashboard or assessment delivery.

The draft form collects a unique identifier, OBD protocol, Bloom level, original stem, expected evidence, rationale, source identifier and source page, and vehicle applicability. It validates the fields locally and produces a review-only JSON object for manual copying. No network, database, browser storage, login, publication, approval or scoring action is available.

Every output remains `draft_needs_independent_review` with SME, source-rights, instructor, production release and assessment flags false. The form does **not** attest that an attached citation or source content is accurate or licensed. User-provided PDF sources remain reference-only pending permissions and technical review.

This is a prototype independent from still-open source-catalog PR #1063 and question-blueprint PR #1064; no migration, runtime assessment changes, student records, or grading. Future work requires role authorization, storage governance, source linking to approved catalog, review/audit decisions, instructor accessibility testing and institution signoff.

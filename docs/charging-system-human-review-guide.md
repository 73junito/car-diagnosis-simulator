# Charging-System Human Review Guide

This packet covers the six `charging-system` questions that have completed deterministic citation validation in staging.

## What is already complete

- Approved source/chunk linkage
- Answer/explanation evidence-fit review
- Citation quote synchronization
- Deterministic citation validation:
  - source hashes verified
  - excerpts verified
  - canonical URLs verified

## What is not complete

- Human technical review
- Human instructional review
- Final approval

No reviewer should mark a question approved as part of this review.

## Technical review

For each question, confirm that:

1. The keyed answer is technically correct within the approved evidence.
2. The explanation does not add claims beyond the approved evidence.
3. The terminology is accurate and unambiguous.
4. The distractors do not introduce a second defensible answer.
5. The retained question is not materially duplicative of another retained item.

Record one decision per question: `pass`, `revise`, or `reject`.

## Instructional review

For each question, confirm that:

1. The stem asks one clear question.
2. There is one best answer.
3. Distractors are parallel in form and appropriate for the difficulty.
4. The item assesses the stated topic rather than test-taking tricks.
5. The explanation is concise and useful to a learner.
6. The item is suitable for the intended post-secondary automotive learning context.

Record one decision per question: `pass`, `revise`, or `reject`.

## Completion rule

Only questions that receive `pass` from both human reviews may have the reviewer UUID/timestamp fields populated. Questions requiring revision must remain `validated` with the human-review checklist values false until they are revised and revalidated.

The SQL file at `supabase/drafts/charging-system-human-review-completion.sql` is a template only. It must not be executed until real reviewer identities are known and all six questions have actually passed both reviews.

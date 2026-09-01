# Seed safety

The configured entry point is `../seed.sql`, a portable, fail-closed no-op that
checks the foundation table and never creates assessment content.

Three legacy reference files remain available for explicit human review:

- `ase_domains.sql` requires `public.ase_domains`.
- `scenario_ase_map.sql` requires `public.scenario_ase_map`.
- `question_quality_review.sql` requires `public.question_quality_scores` and is
  not currently idempotent.

None of these optional tables has been verified in staging, so none is included
automatically. Execute only after independently confirming its schema and safety.

Unsafe generated question, replacement, and fabricated fixture SQL files were
intentionally omitted from this deployment package. The original user-supplied
archive remains the recoverable forensic reference. Never execute those files
against an environment containing legitimate assessment or citation evidence.

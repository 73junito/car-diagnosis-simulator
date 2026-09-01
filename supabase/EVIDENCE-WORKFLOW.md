# Genuine source-to-question evidence workflow

## Non-negotiable prerequisites

1. A rights-cleared source document actually exists.
2. Its source checksum is computed from its real bytes.
3. Each permitted excerpt is genuinely present in the source.
4. Each chunk hash is computed from the exact stored UTF-8 excerpt.
5. Technical and instructional review are completed by real authorized people.
6. Citation validation is produced by the actual validator, not a fixture.
7. Approvals record real reviewer identities and timestamps.

## Computing hashes in PowerShell

```powershell
# Source document: hash actual bytes without disclosing file contents.
Get-FileHash -Path .\evidence\approved-reference.pdf -Algorithm SHA256

# Excerpt: compute UTF-8 bytes from the actual reviewed excerpt.
$Excerpt = Read-Host 'Enter the rights-cleared excerpt to hash'
$Bytes = [Text.Encoding]::UTF8.GetBytes($Excerpt)
$Hash = [Security.Cryptography.SHA256]::HashData($Bytes)
[Convert]::ToHexString($Hash).ToLowerInvariant()
Remove-Variable Excerpt, Bytes, Hash -ErrorAction SilentlyContinue
```

Hashing a source file proves integrity only when the original file and its
rights/licensing review are retained. It does not establish technical accuracy.

## Actual staging relationships

```text
approved_sources.id
    └── source_chunks.source_id + source_chunks.text_hash
            └── question_citations.chunk_id + question_citations.source_id
                    └── question_provenance.id
                            └── scenario_questions.id::text
                    └── citation_validations.question_provenance_id
```

Questions are ingested first as draft provenance. Evidence is then linked,
validated, and reviewed. Publication is last. Requiring approved provenance
before inserting a question creates a circular dependency and is incorrect.

The current evidence exports confirm zero questions for both target scenarios.
Do not ask for Gate 4 JWTs until `verification/03_gate4_readiness.sql` returns
at least two ready `no-crank` records and one ready `charging-system` record.

# Supabase Migration: citation_validations Table

## Overview
The citation validator is implemented and tested but requires the `public.citation_validations` table schema to exist in Supabase. This table will store validation results from the citation validator.

## Current Status
- Migration SQL file: ✅ Created at `supabase/migrations/20260813-create-citation-validations.sql`
- Citation validator code: ✅ Implemented at `scripts/validate-citations.js`
- Citation validator dry-run: ✅ Tested (20/20 questions valid)
- Supabase table: ❌ NOT YET CREATED in database

## Migration Steps

### Step 1: Verify Table Does Not Exist

In the Supabase SQL Editor (https://supabase.com/dashboard/project/pffdgqpynpbffbcnxmum/sql), run:

```sql
select
    to_regclass('public.citation_validations') as table_name,
    exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'citation_validations'
    ) as table_exists;
```

**Expected result before migration:**
```
table_name | table_exists
-----------|-------------
null       | false
```

### Step 2: Apply Migration

Copy and paste the following SQL into the Supabase SQL Editor and execute:

```sql
-- Create citation_validations table for deterministic citation verification
-- This table stores actual validator output, never manufactured evidence.
create table if not exists public.citation_validations (
  id uuid primary key default gen_random_uuid(),
  question_provenance_id uuid not null
    references public.question_provenance(id) on delete cascade,
  validator_version text not null,
  validation_method text not null,
  source_hashes_verified boolean not null,
  excerpts_verified boolean not null,
  urls_verified boolean not null,
  result text not null check (result in ('valid', 'invalid')),
  errors jsonb not null default '[]'::jsonb,
  validated_at timestamptz not null default now(),
  unique (question_provenance_id, validator_version)
);

-- Enable RLS
alter table public.citation_validations enable row level security;

-- Revoke all access by default
revoke all on public.citation_validations from anon, authenticated;

-- Grant narrowly scoped read access: only valid records where all verification flags are true
create policy "Read valid citation validations for authenticated users"
on public.citation_validations
for select
to authenticated
using (
  result = 'valid'
  and source_hashes_verified = true
  and excerpts_verified = true
  and urls_verified = true
);

-- Grant narrowly scoped read access: only valid records for anon (API server)
create policy "Read valid citation validations for anon"
on public.citation_validations
for select
to anon
using (
  result = 'valid'
  and source_hashes_verified = true
  and excerpts_verified = true
  and urls_verified = true
);

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
```

### Step 3: Verify Table Creation

Run this verification query in the Supabase SQL Editor:

```sql
select
    to_regclass('public.citation_validations') as table_name,
    count(*) as current_records
from public.citation_validations;
```

**Expected result after migration:**
```
table_name                      | current_records
--------------------------------|-----------------
public.citation_validations     | 0
```

### Step 4: Verify Data API Discovery

Run this PowerShell command to verify the table is discoverable via Supabase REST API:

```powershell
$SupabaseUrl = "https://pffdgqpynpbffbcnxmum.supabase.co"
$PublishableKey = "sb_publishable_izHdW-8uSXDyOoroubUoDA_ZqnW16cw"
$Headers = @{
    apikey = $PublishableKey
    Authorization = "Bearer $PublishableKey"
}
$Response = Invoke-WebRequest `
    -Uri "$SupabaseUrl/rest/v1/citation_validations?select=id&limit=1" `
    -Headers $Headers `
    -UseBasicParsing
Write-Host "Status: $($Response.StatusCode)"
Write-Host "Content: $($Response.Content)"
```

**Expected response:**
```
Status: 200
Content: []
```

## After Migration: Citation Validator Population

Once the table exists, populate citation validations using this secure PowerShell sequence:

```powershell
Set-Location F:\TorqueMind

$env:SUPABASE_URL = "https://pffdgqpynpbffbcnxmum.supabase.co"

$SecureServiceKey = Read-Host `
    "Enter Supabase service-role key" `
    -AsSecureString

$ServiceKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
    $SecureServiceKey
)

try {
    $env:SUPABASE_SERVICE_KEY = [
        Runtime.InteropServices.Marshal
    ]::PtrToStringBSTR($ServiceKeyPointer)

    # Test with dry-run first (no database writes)
    Write-Host "Running citation validator dry-run..."
    node .\scripts\validate-citations.js `
        --scenario no-crank `
        --dry-run

    if ($LASTEXITCODE -ne 0) {
        throw "Citation-validator dry run failed"
    }

    Write-Host "Dry-run successful. Populating database..."
    
    # Populate database with validation records
    node .\scripts\validate-citations.js `
        --scenario no-crank

    if ($LASTEXITCODE -ne 0) {
        throw "Citation-validation population failed"
    }

    Write-Host "Citation validation population complete!"
}
finally {
    # Securely clear the plaintext key from memory
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
        $ServiceKeyPointer
    )

    Remove-Item Env:SUPABASE_SERVICE_KEY `
        -ErrorAction SilentlyContinue
}
```

**Key Points:**
- The `SecureString` is only held in memory briefly
- Converted to plaintext only for Node.js environment variable
- Plaintext key is zeroed from memory after use
- Service key is removed from environment when complete

## Verification

### Step 1: Verify Database Records Created

Run this SQL in the Supabase SQL Editor:

```sql
select 
    count(*) as total_validations,
    sum(case when result = 'valid' then 1 else 0 end) as valid_count,
    sum(case when result = 'invalid' then 1 else 0 end) as invalid_count
from public.citation_validations
where question_provenance_id in (
    select id from question_provenance where scenario_id = 'no-crank'
);
```

**Expected:**
```
total_validations | valid_count | invalid_count
------------------|-------------|---------------
20                 | 20          | 0
```

### Step 2: Verify API Access

Check that the API returns validation records (respects RLS policies):

```powershell
$PublishableKey = "sb_publishable_izHdW-8uSXDyOoroubUoDA_ZqnW16cw"

$Headers = @{
    apikey        = $PublishableKey
    Authorization = "Bearer $PublishableKey"
}

$ValidationResponse = Invoke-RestMethod `
    -Uri "https://pffdgqpynpbffbcnxmum.supabase.co/rest/v1/citation_validations?select=result,question_provenance_id" `
    -Headers $Headers

$ValidationResponse |
    Group-Object result |
    Select-Object Name, Count |
    Format-Table -AutoSize
```

**Expected Output:**
```
Name  Count
----  -----
valid    20
```

### Step 3: Verify Server Endpoint

Start the API server and test the scenario-questions-approved endpoint:

```powershell
# Terminal 1: Start the server
Set-Location F:\TorqueMind\torquemind-api
$env:SUPABASE_URL = "https://pffdgqpynpbffbcnxmum.supabase.co"
$env:SUPABASE_ANON_KEY = "sb_publishable_izHdW-8uSXDyOoroubUoDA_ZqnW16cw"
$env:PORT = "3003"
node ./index.js

# Terminal 2: Test the endpoint
$QuestionResponse = Invoke-RestMethod `
    "http://127.0.0.1:3003/api/scenario-questions-approved?scenario_id=no-crank"

$Questions = @($QuestionResponse.questions)

$ValidQuestions = @(
    $Questions | Where-Object {
        $_.question_provenance.citation_validation.result -eq 'valid'
    }
)

[PSCustomObject]@{
    QuestionsReturned = $Questions.Count
    ValidatedQuestions = $ValidQuestions.Count
} | Format-List

if ($Questions.Count -ne 20 -or $ValidQuestions.Count -ne 20) {
    throw "Production gate failed: expected 20 returned and 20 validated"
}
```

**Expected Output:**
```
QuestionsReturned   : 20
ValidatedQuestions  : 20
```

### Step 4: Run Production Readiness Tests

Stop the server and run the Playwright E2E tests:

```powershell
# Ctrl-C in Terminal 1 to stop server

# Run both fail-closed and production-readiness tests
npx playwright test `
    tests/playwright/tted805-no-crank-fail-closed.spec.js `
    tests/playwright/tted805-no-crank-production-readiness.spec.js `
    --project=chromium `
    --reporter=list `
    --trace=retain-on-failure

if ($LASTEXITCODE -ne 0) {
    throw "TTED 805 Playwright gates failed"
}
```

**Expected:**
- Fail-closed test: PASS (0 questions when no validation)
- Production-readiness test: PASS (20 questions when validated)

### Step 5: Run Final Validation Pipeline

```powershell
Set-Location F:\TorqueMind

# Run Mermaid verification
npm run docs:mermaid
if ($LASTEXITCODE -ne 0) {
    throw "Mermaid verification failed"
}

# Run Jest test suite
npm test
if ($LASTEXITCODE -ne 0) {
    throw "Jest failed"
}

# Run build
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Build failed"
}
```

**Expected Results:**
```
Mermaid:        11/11 diagrams rendered
Jest:           474/474 tests passing
Build:          Success (exit code 0)
Playwright:     2/2 tests passing
```

## Support

If you encounter any issues:

1. **Permission Denied**: Ensure you're using the service-role key with INSERT permissions
2. **Foreign Key Violation**: The `question_provenance` table must exist with at least 20 'no-crank' questions
3. **RLS Policy Not Found**: Verify both RLS policies were created in Step 2

## Security Notes

- The RLS policies implement fail-closed security: records are only visible when all verification flags are true
- The service-role key should NEVER be committed to version control
- Only SET via interactive prompt: `Read-Host -AsSecureString`
- The citation validator validates all 20 questions deterministically via SHA-256 hashing

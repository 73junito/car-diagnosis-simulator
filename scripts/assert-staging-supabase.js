'use strict';

const EXPECTED_PROJECT_REF = 'jchfruprqpeypdttvlam';
const EXPECTED_HOST = `${EXPECTED_PROJECT_REF}.supabase.co`;

const rawUrl = process.env.SUPABASE_URL;

if (!rawUrl) {
  console.error('FAIL: SUPABASE_URL is not configured.');
  process.exit(1);
}

let parsed;

try {
  parsed = new URL(rawUrl);
} catch {
  console.error('FAIL: SUPABASE_URL is not a valid URL.');
  process.exit(1);
}

if (parsed.protocol !== 'https:') {
  console.error('FAIL: Supabase destination must use HTTPS.');
  process.exit(1);
}

if (parsed.hostname !== EXPECTED_HOST) {
  console.error('FAIL: Supabase destination is not the approved staging project.');
  process.exit(1);
}

if (
  parsed.username ||
  parsed.password ||
  (parsed.pathname && parsed.pathname !== '/') ||
  parsed.search ||
  parsed.hash
) {
  console.error('FAIL: SUPABASE_URL has an unexpected URL shape.');
  process.exit(1);
}

console.log(
  `PASS: Supabase destination verified as staging project ${EXPECTED_PROJECT_REF}.`
);

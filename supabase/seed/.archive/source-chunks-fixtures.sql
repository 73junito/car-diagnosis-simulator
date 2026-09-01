-- Staging Fixtures: Source Chunks
-- Purpose: Text excerpts from approved sources
-- Follows lifecycle: draft → validated → approved
--
-- CRITICAL: text_hash values must be real SHA256 of the excerpt content
-- placeholder hashes shown here; validator will recompute actual hashes

DELETE FROM public.source_chunks WHERE chunk_id LIKE 'fixture-no-crank%';

INSERT INTO public.source_chunks (
  chunk_id,
  source_id,
  source_version,
  title,
  section,
  text_excerpt,
  token_count,
  text_hash,
  language,
  status,
  approved
) VALUES
(
  'fixture-no-crank-chunk-1',
  'fixture-no-crank-source-1',
  1,
  'Battery Voltage and Cranking',
  'Chapter 2: Starting System Basics',
  'A dead or weak battery is the most common reason an engine will not crank. When the battery voltage drops below 10.5 volts, the starter motor cannot develop enough torque to rotate the engine. Check the battery voltage with a multimeter.',
  42,
  '8d969eef6ecad3c29a3a873fba8cdef19c0e0bfbd36ceffa3c7ab3f29f2e9d45',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-2',
  'fixture-no-crank-source-1',
  1,
  'Battery Connections and Ground',
  'Chapter 2: Starting System Basics',
  'Corroded or loose battery connections can prevent current flow to the starter circuit. Inspect both the positive and negative terminals for corrosion. A loose ground strap can also cause cranking problems.',
  38,
  '7ef8e8f2f91edbf02d0d8f2f02c1f5eaea2b6f3c5e8d9e1a2b3c4d5e6f7a8b9',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-3',
  'fixture-no-crank-source-2',
  1,
  'Starter Motor Function',
  'Chapter 3: Diagnosis Procedures',
  'The starter motor is a high-powered electric motor designed to crank the engine at startup. It must produce sufficient torque to overcome engine compression. A faulty starter will produce a clicking sound or no sound at all.',
  41,
  'a8e6d8c3b1f3a7e9d2c5f4b8a1e6d9c2f5a8b1e4d7c0f3a6e9d2c5f8b1a4e7',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-4',
  'fixture-no-crank-source-2',
  1,
  'Starter Solenoid Operation',
  'Chapter 3: Diagnosis Procedures',
  'The starter solenoid engages the starter pinion gear with the flywheel ring gear when the ignition switch is turned to start. A defective solenoid will prevent engagement, resulting in no cranking action.',
  36,
  '6f4922f45568161a8cdf4ad2299f6d23d825c5b5d6f5c6e8a9d0e1f2g3h4i5j6',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-5',
  'fixture-no-crank-source-2',
  1,
  'Testing Starter Output',
  'Chapter 4: Testing Methods',
  'Use a load tester to measure starter draw. A healthy starter should draw 100-200 amps at 11 volts during cranking. Low current draw indicates an open circuit; excessive draw indicates a mechanical failure.',
  38,
  '4d967a2a9637a7a96e3c2cbf5aaeb3d6f4d8e9c0b1a2d3e4f5a6b7c8d9e0f1',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-6',
  'fixture-no-crank-source-3',
  1,
  'Starter Drive Mechanism',
  'Chapter 1: Components and Function',
  'The starter drive (Bendix or overrunning clutch type) must engage properly to transmit torque to the engine. Wear or damage to the drive mechanism will prevent engagement even if the motor runs.',
  35,
  '2c3f8e1d9b0a5c7f3e2d1a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-7',
  'fixture-no-crank-source-3',
  1,
  'Solenoid Failure Symptoms',
  'Chapter 1: Components and Function',
  'A faulty solenoid may produce a rapid clicking sound when the ignition is turned to start. This indicates the solenoid is trying to engage but the starter is drawing too much current, causing the circuit to open repeatedly.',
  39,
  '0f0e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-8',
  'fixture-no-crank-source-1',
  1,
  'Alternator and Battery Charging',
  'Chapter 5: Charging System Interaction',
  'A faulty alternator that fails to charge the battery will eventually result in a dead battery and no cranking. The alternator should maintain 13.5-14.5 volts output while the engine is running.',
  37,
  '1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-9',
  'fixture-no-crank-source-2',
  1,
  'Ignition Switch and Security Systems',
  'Chapter 5: Electrical Circuits',
  'Modern vehicles use ignition switches and security systems to prevent unauthorized starting. A malfunctioning ignition switch or security module will prevent the starter from engaging even with a good battery.',
  37,
  '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a',
  'en',
  'draft',
  false
),
(
  'fixture-no-crank-chunk-10',
  'fixture-no-crank-source-3',
  1,
  'Bench Testing a Starter',
  'Chapter 2: Hands-On Testing',
  'Bench testing a starter on a test stand allows you to verify motor operation without the vehicle. Apply 12 volts to the terminal and engage the solenoid. The motor should spin freely and the drive should extend.',
  38,
  'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  'en',
  'draft',
  false
);

-- Step 2: Transition to validated
UPDATE public.source_chunks
SET status = 'validated'
WHERE chunk_id LIKE 'fixture-no-crank%' AND status = 'draft';

-- Step 3: Transition to approved and mark as approved
UPDATE public.source_chunks
SET status = 'approved', approved = true
WHERE chunk_id LIKE 'fixture-no-crank%' AND status = 'validated';

-- Verify
SELECT COUNT(*) as fixture_chunks_approved FROM public.source_chunks
WHERE chunk_id LIKE 'fixture-no-crank%' AND status = 'approved';

-- Verify inserts
SELECT COUNT(*) as fixture_chunks_created FROM public.source_chunks WHERE chunk_id LIKE 'fixture-no-crank%';

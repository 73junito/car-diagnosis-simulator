const {
  DiagnosticContracts,
  ToolGateway,
  VehicleIdentityResolver,
  evaluateEvidenceGate,
  evaluateDiagnosticDecision,
  buildModelContext,
  getResponsePolicy,
  Provenance,
} = require('../src/ai');

describe('AI Mechanic Assistant architecture contracts', () => {
  test('fails closed when evidence is missing or unapproved', () => {
    expect(evaluateEvidenceGate({ evidence: [] })).toEqual({
      allowed: false,
      status: 'insufficient',
      reasons: ['No evidence supplied'],
    });

    const vehicle = DiagnosticContracts.createVehicleIdentity({ year: 2020, make: 'Example', model: 'X', match: 'exact' });
    const evidence = [DiagnosticContracts.createEvidenceRecord({
      evidenceId: 'e1',
      claimId: 'c1',
      sourceId: 's1',
      sourceType: 'service-data',
      sourceAuthority: 'primary',
      sourceApproval: 'pending',
      claimScope: 'vehicle-specific',
      vehicleMatch: 'exact',
      evidenceStatus: 'supported',
      directlyRelevant: true,
    })];

    expect(evaluateEvidenceGate({ evidence, vehicle }).allowed).toBe(false);
  });

  test('requires primary authority and resolved vehicle match for vehicle-specific claims', () => {
    const vehicle = DiagnosticContracts.createVehicleIdentity({ year: 2020, make: 'Example', model: 'X', match: 'generic' });
    const evidence = [DiagnosticContracts.createEvidenceRecord({
      evidenceId: 'e2',
      claimId: 'c2',
      sourceId: 's2',
      sourceType: 'instructional',
      sourceAuthority: 'instructional',
      sourceApproval: 'approved',
      claimScope: 'vehicle-specific',
      vehicleMatch: 'generic',
      evidenceStatus: 'supported',
      directlyRelevant: true,
    })];

    const result = evaluateEvidenceGate({ evidence, vehicle });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/primary authoritative source/i);
    expect(result.reasons.join(' ')).toMatch(/Vehicle identity/i);
  });

  test('model context strips raw VIN and account identity by construction', () => {
    const session = DiagnosticContracts.createDiagnosticSession({
      sessionId: 'sess-1',
      mode: 'technician',
      vehicle: { vin: '1M8GDM9AXKP042788', year: 2019, make: 'Example', model: 'Y', match: 'exact' },
      complaint: 'warning lamp on',
      symptoms: ['low voltage'],
    });
    const context = buildModelContext({ session });
    expect(context.vehicle.vin).toBeUndefined();
    expect(JSON.stringify(context)).not.toContain('1M8GDM9AXKP042788');
    expect(JSON.stringify(context)).not.toMatch(/userId|email|account/i);
  });

  test('diagnostic decision remains blocked until evidence passes the gate', () => {
    const session = DiagnosticContracts.createDiagnosticSession({
      sessionId: 'sess-2',
      vehicle: { year: 2021, make: 'Example', model: 'Z', match: 'exact' },
    });
    const decision = DiagnosticContracts.createDiagnosticDecision({
      decisionId: 'd1',
      hypothesis: 'charging output is inadequate under load',
      recommendedNextCheck: 'perform an evidence-supported next check',
    });

    const blocked = evaluateDiagnosticDecision({ session, decision, evidence: [] });
    expect(blocked.status).toBe('blocked');
    expect(blocked.nextAction).toBe('collect-more-evidence');
    expect(blocked.verificationRequired).toBe(true);
  });

  test('tool gateway normalizes adapter output before use', async () => {
    const gateway = new ToolGateway();
    gateway.register({
      id: 'nhtsa-recalls',
      sourceType: 'safety-recall',
      async execute() {
        return {
          retrievedAt: '2026-09-25T00:00:00Z',
          vehicleMatch: 'exact',
          canonicalUrl: 'https://api.nhtsa.gov/recalls/',
          cacheStatus: 'hit',
          normalizedData: { recalls: [] },
          rawPayload: { shouldNotPassThrough: true },
        };
      },
    });

    const result = await gateway.execute('nhtsa-recalls');
    expect(result.tool).toBe('nhtsa-recalls');
    expect(result.normalizedData).toEqual({ recalls: [] });
    expect(result.rawPayload).toBeUndefined();
  });

  test('vehicle identity resolver supports cache-first VIN decoding', async () => {
    const calls = [];
    const cache = {
      async get() { return null; },
      async set(key, value) { calls.push({ key, value }); },
    };
    const resolver = new VehicleIdentityResolver({
      cache,
      async vinDecoder(vin) {
        expect(vin).toBe('1M8GDM9AXKP042788');
        return { year: 2019, make: 'Example', model: 'Y', match: 'exact', source: 'nhtsa-vpic' };
      },
    });

    const identity = await resolver.resolve({ vin: '1m8gdm9axkp042788' });
    expect(identity.match).toBe('exact');
    expect(identity.source).toBe('nhtsa-vpic');
    expect(calls).toHaveLength(1);
  });

  test('training and technician response policies stay distinct', () => {
    const training = getResponsePolicy('training');
    const technician = getResponsePolicy('technician');

    expect(training.allowHints).toBe(true);
    expect(technician.allowHints).toBe(false);
    expect(training.responseStyle).not.toBe(technician.responseStyle);
    expect(technician.technicianVerificationRequired).toBe(true);
  });

  test('provenance requires claim-level traceability', () => {
    const result = Provenance.validateProvenance({
      source_id: 'src-1',
      source_type: 'government',
      canonical_url: 'https://example.test/source',
      publisher: 'Example',
      retrieved_at: '2026-09-25T00:00:00Z',
      rights_status: 'approved',
      artifact_sha256: 'abc',
      chunk_id: 'chunk-1',
      claim_id: 'claim-1',
      review_status: 'approved',
    });

    expect(result).toEqual({ valid: true, missing: [] });
    expect(Provenance.REQUIRED_PROVENANCE_FIELDS).toContain('claim_id');
  });
});

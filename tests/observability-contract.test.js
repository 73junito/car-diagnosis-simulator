const { verifyObservabilityContract } = require('../scripts/verify-observability-contract');

describe('production observability contract', () => {
  test('Worker-backed surfaces have governed native logs/traces and static exam remains excluded', () => {
    const result = verifyObservabilityContract();

    expect(result.primaryBackend).toBe('cloudflare-observability');
    expect(result.externalOtlpProvider).toBe('grafana-cloud');
    expect(result.externalOtlpStatus).toBe('pending-account-destination');
    expect(result.workerSurfaces).toEqual(['public', 'app']);
    expect(result.staticSurfaces).toEqual(['exam']);
  });
});

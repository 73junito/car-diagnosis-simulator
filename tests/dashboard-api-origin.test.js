const { resolveApiUrl } = require('../dashboard/api-origin');

describe('dashboard API origin', () => {
  test('uses the apex Worker from the production app deployment', () => {
    expect(resolveApiUrl('/api/torquemind-feedback', {
      hostname: 'app.autolearnpro.com'
    })).toBe('https://autolearnpro.com/api/torquemind-feedback');
  });

  test('keeps same-origin API paths in local and apex environments', () => {
    expect(resolveApiUrl('api/torquemind-feedback', {
      hostname: 'localhost'
    })).toBe('/api/torquemind-feedback');

    expect(resolveApiUrl('/api/torquemind-feedback', {
      hostname: 'autolearnpro.com'
    })).toBe('/api/torquemind-feedback');
  });
});

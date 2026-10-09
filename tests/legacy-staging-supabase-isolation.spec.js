const fs = require('fs');
const path = require('path');

describe('app staging Worker Supabase isolation', () => {
  const raw = fs.readFileSync(path.resolve(__dirname, '..', 'wrangler.app.jsonc'), 'utf8');
  const config = JSON.parse(raw);

  test('staging Worker points only to staging Supabase', () => {
    expect(config.env.staging.name).toBe('autolearnpro-app-staging');
    expect(config.env.staging.vars.TORQUEMIND_ENVIRONMENT).toBe('staging');
    expect(config.env.staging.vars.SUPABASE_URL)
      .toBe('https://jchfruprqpeypdttvlam.supabase.co');
    expect(config.env.staging.vars.SUPABASE_URL)
      .not.toBe('https://pffdgqpynpbffbcnxmum.supabase.co');
  });

  test('production app configuration remains isolated from the public Worker', () => {
    expect(config.name).toBe('autolearnpro-app');
    expect(config.vars.TORQUEMIND_ENVIRONMENT).toBe('production');
  });
});

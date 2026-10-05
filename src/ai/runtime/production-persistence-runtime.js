'use strict';

const { createClient } = require('@supabase/supabase-js');
const SupabaseRunStore = require('../governance/supabase-run-store');
const ProductionRunCoordinator = require('../governance/production-run-coordinator');

const MODES = new Set(['disabled', 'supabase']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function projectRefFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith('.supabase.co')
      ? hostname.slice(0, -'.supabase.co'.length)
      : '';
  } catch {
    return '';
  }
}

function resolveProductionPersistenceConfig(env = {}) {
  const mode = text(env.TORQUEMIND_ORCHESTRATION_PERSISTENCE) || 'disabled';
  if (!MODES.has(mode)) {
    throw new Error('Unsupported orchestration persistence mode');
  }

  if (mode === 'disabled') {
    return {
      enabled: false,
      mode,
      environment: text(env.TORQUEMIND_ENVIRONMENT) || 'unknown',
      credentialSource: null,
      projectRef: null,
    };
  }

  const supabaseUrl = text(env.SUPABASE_URL);
  const secretKey = text(env.SUPABASE_SECRET_KEY);
  const serviceRoleKey = text(env.SUPABASE_SERVICE_ROLE_KEY);
  const credential = secretKey || serviceRoleKey;
  const credentialSource = secretKey
    ? 'SUPABASE_SECRET_KEY'
    : serviceRoleKey
      ? 'SUPABASE_SERVICE_ROLE_KEY'
      : null;

  if (!supabaseUrl || !credential) {
    throw new Error('Orchestration persistence configuration incomplete');
  }

  const projectRef = projectRefFromUrl(supabaseUrl);
  if (!projectRef) {
    throw new Error('Orchestration persistence Supabase URL is invalid');
  }

  const expectedProjectRef = text(
    env.TORQUEMIND_ORCHESTRATION_SUPABASE_PROJECT_REF
  );
  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    throw new Error('Orchestration persistence project reference mismatch');
  }

  return {
    enabled: true,
    mode,
    environment: text(env.TORQUEMIND_ENVIRONMENT) || 'unknown',
    supabaseUrl,
    credential,
    credentialSource,
    projectRef,
  };
}

function createProductionPersistenceRuntime({
  env = {},
  workerId,
  leaseMs = 30000,
  createClientImpl = createClient,
} = {}) {
  const config = resolveProductionPersistenceConfig(env);
  if (!config.enabled) {
    return {
      enabled: false,
      mode: config.mode,
      environment: config.environment,
      credentialSource: null,
      projectRef: null,
      store: null,
      coordinator: null,
    };
  }

  if (!workerId || typeof workerId !== 'string') {
    throw new Error('Production persistence runtime requires workerId');
  }

  const client = createClientImpl(config.supabaseUrl, config.credential, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const store = new SupabaseRunStore({
    workerId,
    leaseMs,
    rpc: (name, params) => client.rpc(name, params),
  });

  return {
    enabled: true,
    mode: config.mode,
    environment: config.environment,
    credentialSource: config.credentialSource,
    projectRef: config.projectRef,
    store,
    coordinator: new ProductionRunCoordinator({ store }),
  };
}

module.exports = {
  createProductionPersistenceRuntime,
  resolveProductionPersistenceConfig,
};

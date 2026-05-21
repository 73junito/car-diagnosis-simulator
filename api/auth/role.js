// Lightweight role resolution scaffold for telemetry auth integration
// This intentionally does NOT verify tokens or contact an auth provider.
// It resolves a best-effort `role` and `userId` from request headers/placeholders.

function resolveUserRole(req) {
  let role = 'anonymous';
  let userId = null;
  let source = 'none';

  if (req && req.headers) {
    if (req.headers['x-torquemind-role']) {
      role = req.headers['x-torquemind-role'];
      source = 'header';
    }
    // Placeholder: if an Authorization header is present we mark the source.
    if (req.headers.authorization) {
      source = source === 'header' ? 'header+token' : 'token';
      // NOTE: do NOT attempt to verify tokens here — that will be implemented
      // in the next PR which integrates a real auth provider.
    }
  }

  return { role, userId, source };
}

module.exports = { resolveUserRole };

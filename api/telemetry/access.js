const path = require('path');
const { addTelemetryEvent } = require('./events');
const { resolveUserRole } = require(path.join(__dirname, '..', 'auth', 'role'));

function hasInstructorAccess(req) {
  // Keep a fast header-only check for callers that need synchronous behavior
  return req && req.headers && req.headers['x-torquemind-role'] === 'instructor';
}

async function requireInstructor(req, res, next) {
  const info = await resolveUserRole(req || {});
  const allowed = info && info.role === 'instructor';

  // audit the access attempt with richer context
  try {
    addTelemetryEvent({
      type: 'access_attempt',
      scope: 'live-session',
      role: info.role,
      userId: info.userId || null,
      source: info.source || null,
      allowed: Boolean(allowed),
      timestamp: new Date().toISOString()
    });
  } catch (e) { /* swallow audit errors */ }

  if (!allowed) {
    if (res && typeof res.status === 'function') {
      return res.status(401).send('<html><body><h1>Unauthorized</h1><p>Instructor access required</p></body></html>');
    }
    return false;
  }

  if (typeof next === 'function') return next();
  return true;
}

module.exports = { hasInstructorAccess, requireInstructor };

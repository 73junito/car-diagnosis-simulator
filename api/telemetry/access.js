const { addTelemetryEvent } = require('./events');

function hasInstructorAccess(req) {
  return req && req.headers && req.headers['x-torquemind-role'] === 'instructor';
}

function requireInstructor(req, res, next) {
  const role = (req && req.headers && req.headers['x-torquemind-role']) || 'anonymous';
  const allowed = hasInstructorAccess(req);

  // audit the access attempt
  try {
    addTelemetryEvent({
      type: 'access_attempt',
      scope: 'live-session',
      role,
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

  if (typeof next === 'function') next();
  return true;
}

module.exports = { hasInstructorAccess, requireInstructor };

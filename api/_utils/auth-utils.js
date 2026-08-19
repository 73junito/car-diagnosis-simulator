/**
 * Authentication utilities for Supabase JWT verification
 *
 * Enforces:
 * - Valid Supabase JWT in Authorization header
 * - User identity verification server-side
 * - Role-based access control (professor/admin only for sensitive endpoints)
 */
import { createClient } from '@supabase/supabase-js';
/**
 * Extract and verify Supabase JWT from Authorization header
 *
 * @param {string} authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns {string|null} - Valid JWT token or null if invalid
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
/**
 * Verify JWT token and retrieve authenticated user
 *
 * @param {string} token - Supabase JWT token
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} supabaseServiceRoleKey - Supabase service role key
 * @returns {Object} - { user: {...}, error: null } or { user: null, error: "message" }
 */
async function verifySupabaseToken(token, supabaseUrl, supabaseServiceRoleKey) {
  if (!token || !supabaseUrl || !supabaseServiceRoleKey) {
    return {
      user: null,
      error: 'Missing required authentication parameters'
    };
  }

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        error: 'Invalid or expired token'
      };
    }

    return { user, error: null };
  } catch (err) {
    console.error('Token verification failed:', err.message);

    return {
      user: null,
      error: 'Authentication failed'
    };
  }
}
/**
 * Middleware: Require authenticated user
 *
 * @param {Object} request - Express/Node request object
 * @param {Object} response - Express/Node response object
 * @returns {Object} - { user: {...}, isAuthenticated: true } or null if auth failed
 */
async function requireAuthenticatedUser(request, response, supabaseUrl, supabaseServiceRoleKey) {
  const authHeader = request.headers.authorization;
  const token = extractBearerToken(authHeader);
  if (!token) {
    response.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const { user, error } = await verifySupabaseToken(token, supabaseUrl, supabaseServiceRoleKey);
  if (error || !user) {
    response.status(401).json({ error: error || 'Authentication failed' });
    return null;
  }
  return { user, isAuthenticated: true };
}
/**
 * Check if user has professor or admin role
 *
 * @param {Object} user - Supabase user object with app_metadata
 * @returns {boolean} - true if user is professor or admin
 */
function isProfessor(user) {
  if (!user || !user.app_metadata) {
    return false;
  }
  const role = user.app_metadata.role;
  return role === 'professor' || role === 'admin';
}
/**
 * Middleware: Require professor or admin role
 *
 * @param {Object} user - Supabase user object
 * @param {Object} response - Express/Node response object
 * @returns {boolean} - true if authorized, false otherwise (response already sent)
 */
function requireProfessorRole(user, response) {
  if (!isProfessor(user)) {
    response.status(403).json({ error: 'Professor access required' });
    return false;
  }
  return true;
}
export {
  extractBearerToken,
  verifySupabaseToken,
  requireAuthenticatedUser,
  isProfessor,
  requireProfessorRole
};

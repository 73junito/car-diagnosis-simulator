'use strict';

// Mock @supabase/supabase-js so createClient inside auth.js is controllable
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const { createClient } = require('@supabase/supabase-js');
const createAuth = require('../middleware/auth');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(authHeader) {
  return { headers: authHeader ? { authorization: authHeader } : {}, method: 'GET', path: '/' };
}

// Build a minimal Supabase-like client for the outer `supabase` argument
function makeSupabase(getUserResult) {
  return { auth: { getUser: jest.fn().mockResolvedValue(getUserResult) } };
}

// Build a chainable mock Supabase client for profile/user table lookups
function makeAuthedClient({ profileResult, usersResult } = {}) {
  const makeSingle = (result) => jest.fn().mockResolvedValue(result || { data: null, error: null });
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: makeSingle(profileResult) };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue({ maybeSingle: makeSingle(profileResult) });

  // Second chain for users fallback
  const usersChain = { select: jest.fn(), eq: jest.fn(), maybeSingle: makeSingle(usersResult) };
  usersChain.select.mockReturnValue(usersChain);
  usersChain.eq.mockReturnValue({ maybeSingle: makeSingle(usersResult) });

  let callCount = 0;
  const fromMock = jest.fn().mockImplementation(() => {
    callCount += 1;
    return callCount === 1 ? chain : usersChain;
  });

  return { from: fromMock, auth: { getUser: jest.fn() } };
}

describe('auth middleware', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
    // Default: createClient returns a no-op authed client
    createClient.mockReturnValue(makeAuthedClient());
  });

  describe('when supabase argument is null (not configured)', () => {
    it('sets req.user = null and calls next()', async () => {
      const middleware = createAuth(null);
      const req = makeReq();
      const res = makeRes();
      await middleware(req, res, next);
      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('sets req.user = null even when an Authorization header is present', async () => {
      const middleware = createAuth(null);
      const req = makeReq('Bearer sometoken');
      const res = makeRes();
      await middleware(req, res, next);
      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('when supabase is configured but no auth header', () => {
    it('sets req.user = null and calls next() when Authorization header is absent', async () => {
      const supabase = makeSupabase({ data: null, error: null });
      const middleware = createAuth(supabase);
      const req = makeReq();
      const res = makeRes();
      await middleware(req, res, next);
      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it('sets req.user = null and calls next() when header is not Bearer scheme', async () => {
      const supabase = makeSupabase({ data: null, error: null });
      const middleware = createAuth(supabase);
      const req = makeReq('Basic dXNlcjpwYXNz');
      const res = makeRes();
      await middleware(req, res, next);
      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });
  });

  describe('when Bearer token is invalid', () => {
    it('returns 401 when getUser returns an error', async () => {
      const supabase = makeSupabase({ data: null, error: { message: 'JWT invalid' } });
      const middleware = createAuth(supabase);
      const req = makeReq('Bearer badtoken123');
      const res = makeRes();
      await middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    it('returns 401 when getUser returns no user in data', async () => {
      const supabase = makeSupabase({ data: { user: null }, error: null });
      const middleware = createAuth(supabase);
      const req = makeReq('Bearer nouser');
      const res = makeRes();
      await middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when data itself is null', async () => {
      const supabase = makeSupabase({ data: null, error: null });
      const middleware = createAuth(supabase);
      const req = makeReq('Bearer nulldata');
      const res = makeRes();
      await middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('when Bearer token is valid', () => {
    const mockUser = { id: 'uid-1', email: 'teacher@school.com' };

    it('populates req.user with profile data and calls next()', async () => {
      const supabase = makeSupabase({ data: { user: mockUser }, error: null });
      const mockProfile = { id: 'uid-1', email: 'teacher@school.com', role: 'teacher' };
      createClient.mockReturnValue(makeAuthedClient({ profileResult: { data: mockProfile, error: null } }));

      const middleware = createAuth(supabase);
      const req = makeReq('Bearer validtoken');
      const res = makeRes();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ id: 'uid-1', email: 'teacher@school.com', role: 'teacher' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('falls back to users table when profile is empty', async () => {
      const supabase = makeSupabase({ data: { user: mockUser }, error: null });
      // Profile returns empty object; users returns data
      const mockUserRow = { id: 'uid-1', email: 'teacher@school.com', role: 'student' };
      createClient.mockReturnValue(makeAuthedClient({
        profileResult: { data: {}, error: null },
        usersResult: { data: mockUserRow, error: null },
      }));

      const middleware = createAuth(supabase);
      const req = makeReq('Bearer validtoken');
      const res = makeRes();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ id: 'uid-1', email: 'teacher@school.com' });
    });

    it('still calls next() when both profile and users lookups fail', async () => {
      const supabase = makeSupabase({ data: { user: mockUser }, error: null });
      createClient.mockReturnValue(makeAuthedClient({
        profileResult: { data: null, error: { message: 'no profile' } },
        usersResult: { data: null, error: { message: 'no user row' } },
      }));

      const middleware = createAuth(supabase);
      const req = makeReq('Bearer validtoken');
      const res = makeRes();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      // Basic user info should still be present
      expect(req.user).toMatchObject({ id: 'uid-1', email: 'teacher@school.com' });
    });

    it('returns 500 when getUser throws an exception', async () => {
      const supabase = { auth: { getUser: jest.fn().mockRejectedValue(new Error('network error')) } };
      const middleware = createAuth(supabase);
      const req = makeReq('Bearer boom');
      const res = makeRes();
      await middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });
});

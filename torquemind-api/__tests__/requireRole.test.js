'use strict';

const requireRole = require('../middleware/requireRole');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeApp(configured) {
  return { get: (key) => (key === 'supabaseConfigured' ? configured : undefined) };
}

describe('requireRole middleware', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
  });

  describe('when supabase is not configured', () => {
    it('calls next() regardless of user or role', () => {
      const middleware = requireRole('teacher');
      const req = { app: makeApp(false), user: null };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() even when user has no role', () => {
      const middleware = requireRole('admin');
      const req = { app: makeApp(false), user: { id: 'u1', role: 'student' } };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('when supabase is configured', () => {
    it('returns 401 when req.user is null', () => {
      const middleware = requireRole('teacher');
      const req = { app: makeApp(true), user: null };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns 401 when req.user is undefined', () => {
      const middleware = requireRole('teacher');
      const req = { app: makeApp(true) };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 403 when user role does not match required role', () => {
      const middleware = requireRole('teacher');
      const req = { app: makeApp(true), user: { id: 'u1', role: 'student' } };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient role' });
    });

    it('returns 403 when user has no role property', () => {
      const middleware = requireRole('teacher');
      const req = { app: makeApp(true), user: { id: 'u1' } };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('calls next() when user role matches required role', () => {
      const middleware = requireRole('teacher');
      const req = { app: makeApp(true), user: { id: 'u1', role: 'teacher' } };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() for any role when user matches', () => {
      const middleware = requireRole('admin');
      const req = { app: makeApp(true), user: { id: 'u1', role: 'admin' } };
      const res = makeRes();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

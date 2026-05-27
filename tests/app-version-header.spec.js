/* eslint-env jest */

process.env.APP_VERSION = process.env.APP_VERSION || 'test-version';

// Mock supabase client to avoid requiring the real package in tests
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [] }),
    }),
  }),
}), { virtual: true });

const load = require('../api/attempts/load');
const save = require('../api/attempts/save');
const summary = require('../api/analytics/summary');
const students = require('../api/analytics/students');
const sessions = require('../api/analytics/sessions');

function makeRes() {
  const headers = {};
  return {
    headers,
    setHeader: jest.fn((k, v) => { headers[k] = v; }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('API app-version header', () => {
  test('attempts/load sets x-app-version', async () => {
    const req = { method: 'GET', query: { scenario: 'foo' } };
    const res = makeRes();
    await load(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('x-app-version', expect.any(String));
    expect(res.headers['x-app-version']).toBe(process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || 'dev');
  });

  test('attempts/save sets x-app-version', async () => {
    const req = { method: 'POST', body: { scenario: 'foo', workflow_type: 't' } };
    const res = makeRes();
    await save(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('x-app-version', expect.any(String));
    expect(res.headers['x-app-version']).toBe(process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || 'dev');
  });

  test('analytics handlers set x-app-version', () => {
    const req = { method: 'GET' };
    const res1 = makeRes();
    summary(req, res1);
    expect(res1.setHeader).toHaveBeenCalledWith('x-app-version', expect.any(String));
    expect(res1.headers['x-app-version']).toBe(process.env.APP_VERSION || process.env.GITHUB_SHA || 'dev');

    const res2 = makeRes();
    students(req, res2);
    expect(res2.setHeader).toHaveBeenCalledWith('x-app-version', expect.any(String));
    expect(res2.headers['x-app-version']).toBe(process.env.APP_VERSION || process.env.GITHUB_SHA || 'dev');

    const res3 = makeRes();
    sessions(req, res3);
    expect(res3.setHeader).toHaveBeenCalledWith('x-app-version', expect.any(String));
    expect(res3.headers['x-app-version']).toBe(process.env.APP_VERSION || process.env.GITHUB_SHA || 'dev');
  });
});

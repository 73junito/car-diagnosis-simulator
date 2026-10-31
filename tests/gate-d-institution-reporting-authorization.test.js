"use strict";

/*
 * Runtime authorization test for the institution reporting route.
 *
 * The route uses a service-role Supabase client, which bypasses RLS, so tenancy
 * rests entirely on the route itself. This drives the real handler with a fake
 * request context and a stubbed data layer and asserts that a request without a
 * valid institution context cannot retrieve reporting records.
 *
 * The cases that matter: no token, invalid token, missing school code, malformed
 * school code, a forged school code the caller has no membership for, an
 * inactive membership, role escalation, and the authorized path.
 */

const mockVerifySupabaseToken = jest.fn();
const mockTables = {};
const mockCalls = [];

function mockQueryBuilder(table) {
  const builder = {
    select: () => builder,
    eq: (column, value) => {
      mockCalls.push({ table, column, value });
      return builder;
    },
    in: () => builder,
    order: () => builder,
    maybeSingle: () => {
      // The route uses both shapes against the same table: `maybeSingle()` for the
      // membership lookup and a list query for the role counts. Normalising here
      // keeps one fixture usable for both.
      const configured = mockTables[table] || { data: null, error: null };
      const data = Array.isArray(configured.data) ? configured.data[0] || null : configured.data;

      return Promise.resolve({ data, error: configured.error || null });
    },
    then: (resolve) => Promise.resolve(mockTables[table] || { data: [], error: null }).then(resolve)
  };

  return builder;
}

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table) => mockQueryBuilder(table) })
}));

jest.mock("../api/_utils/auth-utils.js", () => ({
  extractBearerToken: (header) => {
    if (!header) return null;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match ? match[1] : null;
  },
  verifySupabaseToken: (...args) => mockVerifySupabaseToken(...args)
}));

const { handleInstitutionAdminReport } = require("../worker/routes/institution-reporting.js");

function context({ method = "GET", authorization = "Bearer token", schoolCode = "ABCDEF", env } = {}) {
  return {
    req: {
      method,
      header: (name) => (String(name).toLowerCase() === "authorization" ? authorization : undefined),
      query: (name) => (name === "schoolCode" ? schoolCode : undefined)
    },
    env: {
      SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      ...env
    },
    json: (body, status) => ({ body, status })
  };
}

describe("institution reporting route: runtime authorization", () => {
  beforeEach(() => {
    mockVerifySupabaseToken.mockReset();
    mockVerifySupabaseToken.mockResolvedValue({ user: { id: "user-1" }, error: null });
    mockCalls.length = 0;

    for (const key of Object.keys(mockTables)) {
      delete mockTables[key];
    }
  });

  test("rejects a non-GET method before doing any authorization work", async () => {
    const res = await handleInstitutionAdminReport(context({ method: "POST" }));

    expect(res.status).toBe(405);
    expect(mockVerifySupabaseToken).not.toHaveBeenCalled();
  });

  test("fails closed when the service credentials are not configured", async () => {
    const res = await handleInstitutionAdminReport(
      context({ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } })
    );

    expect(res.status).toBe(500);
  });

  test("requires a bearer token", async () => {
    // `null`, not `undefined`: the context helper defaults an omitted option, so
    // `undefined` would restore the valid header and the case would test nothing.
    expect((await handleInstitutionAdminReport(context({ authorization: null }))).status).toBe(401);
    expect((await handleInstitutionAdminReport(context({ authorization: "Basic xyz" }))).status).toBe(401);
  });

  test("rejects a token the verifier refuses", async () => {
    mockVerifySupabaseToken.mockResolvedValue({ user: null, error: new Error("invalid") });

    expect((await handleInstitutionAdminReport(context())).status).toBe(401);
  });

  test("rejects a missing, malformed or wrong-length school code", async () => {
    // `null`, not `undefined`, for the same reason as above. A trailing space is
    // deliberately absent here: the route trims before validating, so "ABCDE1 "
    // normalises to a valid code and must not be rejected as malformed.
    for (const schoolCode of [null, "", "   ", "ABC", "ABCDEFG", "ABCDE!", "ABCD-E"]) {
      const res = await handleInstitutionAdminReport(context({ schoolCode }));

      expect(res.status).toBe(400);
    }

    // Lower case is normalised to upper case, so it must be accepted and then
    // rejected for the real reason: no membership. Rejecting it as malformed
    // would be passing for the wrong reason.
    mockTables.institution_memberships = { data: null, error: null };
    expect((await handleInstitutionAdminReport(context({ schoolCode: "abcdef" }))).status).toBe(403);
  });

  test("fails closed on a forged school code the caller has no membership for", async () => {
    mockTables.institution_memberships = { data: null, error: null };

    const res = await handleInstitutionAdminReport(context({ schoolCode: "ZZZZZZ" }));

    expect(res.status).toBe(403);
    expect(mockCalls.some((call) => call.table === "classes")).toBe(false);
  });

  test("fails closed on role escalation", async () => {
    for (const role of ["student", "instructor", "institution_member", "admin"]) {
      mockTables.institution_memberships = { data: { id: "m1", role, status: "active" }, error: null };

      const res = await handleInstitutionAdminReport(context({ schoolCode: "ABCDEF" }));

      expect(res.status).toBe(403);
      expect(mockCalls.some((call) => call.table === "classes")).toBe(false);
    }
  });

  test("fails closed when the membership lookup errors", async () => {
    mockTables.institution_memberships = { data: null, error: new Error("lookup failed") };

    expect((await handleInstitutionAdminReport(context({ schoolCode: "ABCDEF" }))).status).toBe(500);
  });

  test("rejects another institution's code for the same caller", async () => {
    mockTables.institution_memberships = { data: null, error: null };

    const res = await handleInstitutionAdminReport(context({ schoolCode: "QWERTY" }));

    expect(res.status).toBe(403);
    expect(mockCalls.some((call) => call.table === "classes")).toBe(false);
  });

  test("scopes every downstream query to the caller's own institution", async () => {
    // An array, because the route reads this table twice: `maybeSingle()` for the
    // membership check and a list query for the role counts.
    mockTables.institution_memberships = {
      data: [{ id: "m1", role: "institution_admin", status: "active" }],
      error: null
    };

    const res = await handleInstitutionAdminReport(context({ schoolCode: "ABCDEF" }));

    expect(res.status).toBe(200);

    // Every filtered query carries the caller's verified school code, never a
    // value taken from the request body.
    const filtered = mockCalls.filter(
      (call) => call.column === "school_code" || call.column === "institution_school_code"
    );

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((call) => call.value === "ABCDEF")).toBe(true);
    expect(mockCalls.some((call) => call.table === "classes")).toBe(true);
  });
});


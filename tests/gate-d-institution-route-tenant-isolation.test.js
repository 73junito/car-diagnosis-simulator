"use strict";

/*
 * Runtime tenant-isolation test for the institution routes.
 *
 * The institution routes use a service-role Supabase client, which bypasses RLS,
 * so tenancy rests entirely on the route itself. The migration matrix proves the
 * same scoping at the query path; this proves the route handlers apply it, by
 * driving the real handlers and asserting that a caller cannot reach another
 * institution's data.
 *
 * The stub applies the filters the route asks for, so a route that drops a scope
 * sees the row it must not see, exactly as the database would hand it back. A stub
 * that ignored the filters would make every scoping assertion pass vacuously.
 *
 * The cases that matter: an institution portal, its settings, its member list and
 * the student claim queue are all refused unless the caller holds an active
 * membership in the institution being read; every downstream query carries the
 * verified school code; and a student reads only their own claim.
 */

const mockVerifySupabaseToken = jest.fn();
const mockTables = {};
const mockCalls = [];

function configured(table, op) {
  const entry = mockTables[table];
  if (!entry) return { data: null, error: null };
  if (entry[op] !== undefined) return entry[op];
  return entry;
}

function rowsOf(config) {
  const data = config?.data;
  if (Array.isArray(data)) return data;
  if (data === null || data === undefined) return [];
  return [data];
}

function matchingRows(table, filters) {
  const entry = mockTables[table];
  if (!entry || !Array.isArray(entry.rows)) return [];

  return entry.rows.filter((row) =>
    filters.every((filter) => {
      if (filter.values) return filter.values.includes(row[filter.column]);
      if (filter.pattern) {
        return String(row[filter.column] || "").toLowerCase().includes(filter.pattern);
      }
      return row[filter.column] === filter.value;
    })
  );
}

function mockQueryBuilder(table) {
  const builder = {
    op: null,
    filters: [],
    select: (columns) => {
      if (!builder.op) builder.op = "select";
      mockCalls.push({ table, op: "select", columns });
      return builder;
    },
    eq: (column, value) => {
      mockCalls.push({ table, op: "eq", column, value });
      builder.filters.push({ column, value });
      return builder;
    },
    in: (column, value) => {
      mockCalls.push({ table, op: "in", column, value });
      builder.filters.push({ column, values: value });
      return builder;
    },
    ilike: (column, pattern) => {
      mockCalls.push({ table, op: "ilike", column, value: pattern });
      builder.filters.push({ column, pattern: String(pattern).replace(/%/g, "").toLowerCase() });
      return builder;
    },
    order: (column) => {
      mockCalls.push({ table, op: "order", column });
      return builder;
    },
    limit: () => builder,
    upsert: (payload) => {
      builder.op = "upsert";
      mockCalls.push({ table, op: "upsert", payload });
      return builder;
    },
    insert: (payload) => {
      builder.op = "insert";
      mockCalls.push({ table, op: "insert", payload });
      return builder;
    },
    maybeSingle: () => {
      if (builder.op === "upsert" || builder.op === "insert") {
        const config = configured(table, builder.op);
        return Promise.resolve({ data: rowsOf(config)[0] || null, error: config.error || null });
      }
      const rows = matchingRows(table, builder.filters);
      return Promise.resolve({ data: rows[0] || null, error: mockTables[table]?.error || null });
    },
    single: () => {
      if (builder.op === "upsert" || builder.op === "insert") {
        const config = configured(table, builder.op);
        return Promise.resolve({ data: rowsOf(config)[0] || null, error: config.error || null });
      }
      const rows = matchingRows(table, builder.filters);
      return Promise.resolve({ data: rows[0] || null, error: mockTables[table]?.error || null });
    },
    then: (resolve, reject) => {
      if (builder.op === "upsert" || builder.op === "insert") {
        const config = configured(table, builder.op);
        return Promise.resolve({ data: rowsOf(config), error: config.error || null }).then(resolve, reject);
      }
      const rows = matchingRows(table, builder.filters);
      return Promise.resolve({ data: rows, error: mockTables[table]?.error || null }).then(resolve, reject);
    }
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

const {
  handleInstitutionMemberships,
  handleInstitutionPortal
} = require("../worker/routes/institution-portal.js");
const { handleInstitutionAdminSettings } = require("../worker/routes/institution-settings-domains.js");
const { handleInstitutionAdminMembers } = require("../worker/routes/institution-membership-admin.js");
const {
  handleStudentInstitutionClaimStatus,
  handleStudentInstitutionClaimQueue
} = require("../worker/routes/student-institution-claims.js");
const { handleInstitutionSearch } = require("../worker/routes/institution-search.js");

function context({ method = "GET", authorization = "Bearer token", params = {}, query = {}, body } = {}) {
  return {
    req: {
      method,
      header: (name) => (String(name).toLowerCase() === "authorization" ? authorization : undefined),
      param: (name) => params[name],
      query: (name) => query[name],
      json: async () => {
        if (body === undefined) throw new Error("no request body");
        return body;
      }
    },
    env: {
      SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    },
    json: (payload, status) => ({ body: payload, status })
  };
}

function callsFor(table, op) {
  return mockCalls.filter((call) => call.table === table && (!op || call.op === op));
}

function scopeOn(table, column) {
  return callsFor(table, "eq").filter((call) => call.column === column);
}

describe("institution routes: runtime tenant isolation", () => {
  beforeEach(() => {
    mockVerifySupabaseToken.mockReset();
    mockVerifySupabaseToken.mockResolvedValue({ user: { id: "user-1" }, error: null });
    mockCalls.length = 0;

    for (const key of Object.keys(mockTables)) {
      delete mockTables[key];
    }
  });
test("refuses the institution portal without an active membership and reads no tenant data", async () => {
    mockTables.institution_memberships = { rows: [], error: null };

    const res = await handleInstitutionPortal(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(403);

    // The membership check must complete before any tenant table is read.
    expect(callsFor("institutions").length).toBe(0);
    expect(callsFor("institution_programs").length).toBe(0);
    expect(callsFor("institution_cohorts").length).toBe(0);
    expect(callsFor("classes").length).toBe(0);
  });

  test("scopes every portal query to the verified institution", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" }
      ],
      error: null
    };
    mockTables.institutions = { rows: [{ school_code: "AAAAA1", school_name: "Alpha" }], error: null };
    mockTables.institution_programs = { rows: [], error: null };
    mockTables.institution_cohorts = { rows: [], error: null };
    mockTables.classes = { rows: [], error: null };

    const res = await handleInstitutionPortal(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(200);

    // The membership is resolved for the caller's own user id and an active status.
    const membershipScope = scopeOn("institution_memberships", "user_id");
    expect(membershipScope.length).toBeGreaterThan(0);
    expect(membershipScope.every((call) => call.value === "user-1")).toBe(true);
    expect(scopeOn("institution_memberships", "status").map((call) => call.value)).toEqual(["active"]);

    // Every tenant read carries the verified school code.
    expect(scopeOn("institutions", "school_code").map((call) => call.value)).toEqual(["AAAAA1"]);
    expect(scopeOn("institution_programs", "school_code").map((call) => call.value)).toEqual(["AAAAA1"]);
    expect(scopeOn("institution_cohorts", "school_code").map((call) => call.value)).toEqual(["AAAAA1"]);
    expect(scopeOn("classes", "institution_school_code").map((call) => call.value)).toEqual(["AAAAA1"]);
  });

  test("shows an instructor only the classes they own", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "instructor", status: "active" }
      ],
      error: null
    };
    mockTables.institutions = { rows: [{ school_code: "AAAAA1", school_name: "Alpha" }], error: null };
    mockTables.institution_programs = { rows: [], error: null };
    mockTables.institution_cohorts = { rows: [], error: null };
    mockTables.classes = {
      rows: [
        { id: "class-a", name: "Class A", owner_id: "user-1", institution_school_code: "AAAAA1" },
        { id: "class-b", name: "Class B", owner_id: "user-2", institution_school_code: "AAAAA1" }
      ],
      error: null
    };

    const res = await handleInstitutionPortal(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(200);
    expect(scopeOn("classes", "owner_id").map((call) => call.value)).toEqual(["user-1"]);
    expect(res.body.classes.map((row) => row.id)).toEqual(["class-a"]);
  });

  test("shows an institution admin the classes of their own institution", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" }
      ],
      error: null
    };
    mockTables.institutions = { rows: [{ school_code: "AAAAA1", school_name: "Alpha" }], error: null };
    mockTables.institution_programs = { rows: [], error: null };
    mockTables.institution_cohorts = { rows: [], error: null };
    mockTables.classes = {
      rows: [
        { id: "class-a", name: "Class A", owner_id: "user-1", institution_school_code: "AAAAA1" },
        { id: "class-b", name: "Class B", owner_id: "user-2", institution_school_code: "AAAAA1" },
        { id: "class-c", name: "Class C", owner_id: "user-3", institution_school_code: "BBBBB2" }
      ],
      error: null
    };

    const res = await handleInstitutionPortal(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(200);
    expect(res.body.administrationGranted).toBe(true);
    // An administrator sees the whole institution, but never another institution's.
    expect(scopeOn("classes", "owner_id").length).toBe(0);
    expect(res.body.classes.map((row) => row.id)).toEqual(["class-a", "class-b"]);
  });

  test("lists only the caller's own memberships", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "instructor", status: "active" },
        { id: "m2", user_id: "user-2", school_code: "BBBBB2", role: "instructor", status: "active" }
      ],
      error: null
    };
    mockTables.institutions = { rows: [{ school_code: "AAAAA1", school_name: "Alpha" }], error: null };

    const res = await handleInstitutionMemberships(context());

    expect(res.status).toBe(200);
    expect(res.body.memberships.map((row) => row.schoolCode)).toEqual(["AAAAA1"]);

    // The directory lookup is limited to the codes the caller actually holds.
    const inScope = callsFor("institutions", "in").filter((call) => call.column === "school_code");
    expect(inScope.length).toBeGreaterThan(0);
    expect(inScope.every((call) => call.value.includes("AAAAA1"))).toBe(true);
    expect(inScope.every((call) => !call.value.includes("BBBBB2"))).toBe(true);
  });

test("refuses institution settings for an institution the caller does not administer", async () => {
    mockTables.institution_memberships = { rows: [], error: null };

    const res = await handleInstitutionAdminSettings(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(403);
    expect(callsFor("institution_settings").length).toBe(0);
  });

  test("refuses institution settings for a membership that is not an administrator", async () => {
    mockTables.institution_memberships = {
      rows: [{ id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "member", status: "active" }],
      error: null
    };

    const res = await handleInstitutionAdminSettings(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(403);
    expect(callsFor("institution_settings").length).toBe(0);
  });

  test("scopes the settings read to the verified institution", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" }
      ],
      error: null
    };
    mockTables.institution_settings = {
      rows: [{ school_code: "AAAAA1", display_name: "Alpha" }],
      error: null
    };

    const res = await handleInstitutionAdminSettings(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(200);
    expect(res.body.actorRole).toBe("institution_admin");

    // The membership is resolved for the caller themselves, so another
    // administrator of the same institution cannot stand in for them.
    const userScope = scopeOn("institution_memberships", "user_id");
    expect(userScope.length).toBeGreaterThan(0);
    expect(userScope.every((call) => call.value === "user-1")).toBe(true);

    expect(scopeOn("institution_settings", "school_code").map((call) => call.value)).toEqual(["AAAAA1"]);
  });

  test("writes settings to the verified institution code", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" }
      ],
      error: null
    };
    mockTables.institution_settings = {
      upsert: { data: { school_code: "AAAAA1", display_name: "Alpha" }, error: null }
    };

    const res = await handleInstitutionAdminSettings(
      context({ method: "PATCH", body: { schoolCode: "AAAAA1", displayName: "Alpha" } })
    );

    expect(res.status).toBe(200);

    const upsert = callsFor("institution_settings", "upsert")[0];
    expect(upsert.payload.school_code).toBe("AAAAA1");
    expect(upsert.payload.updated_by).toBe("user-1");
  });

  test("refuses to write settings to an institution the caller does not administer", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" }
      ],
      error: null
    };

    const res = await handleInstitutionAdminSettings(
      context({ method: "PATCH", body: { schoolCode: "BBBBB2", displayName: "Beta" } })
    );

    expect(res.status).toBe(403);
    expect(callsFor("institution_settings", "upsert").length).toBe(0);
  });

  test("returns only the caller's own claim", async () => {
    mockTables.student_institution_claims = {
      rows: [
        { user_id: "user-1", school_code: "AAAAA1", status: "claimed" },
        { user_id: "user-2", school_code: "AAAAA1", status: "claimed" }
      ],
      error: null
    };

    const res = await handleStudentInstitutionClaimStatus(context());

    expect(res.status).toBe(200);
    expect(scopeOn("student_institution_claims", "user_id").map((call) => call.value)).toEqual(["user-1"]);
    expect(res.body.claim.userId).toBe("user-1");
  });

  test("refuses the claim queue to a caller with no reviewer membership", async () => {
    mockTables.institution_memberships = {
      rows: [{ user_id: "user-1", school_code: "AAAAA1", role: "student", status: "active" }],
      error: null
    };

    const res = await handleStudentInstitutionClaimQueue(context());

    expect(res.status).toBe(403);
    expect(callsFor("student_institution_claims").length).toBe(0);
  });

  test("scopes the claim queue to the reviewer's institutions", async () => {
    mockTables.institution_memberships = {
      rows: [
        { user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" }
      ],
      error: null
    };
    mockTables.student_institution_claims = {
      rows: [
        { user_id: "student-1", school_code: "AAAAA1", status: "claimed" },
        { user_id: "student-2", school_code: "BBBBB2", status: "claimed" }
      ],
      error: null
    };
    mockTables.institutions = { rows: [{ school_code: "AAAAA1", school_name: "Alpha" }], error: null };

    const res = await handleStudentInstitutionClaimQueue(context());

    expect(res.status).toBe(200);

    const inScope = callsFor("student_institution_claims", "in").filter(
      (call) => call.column === "school_code"
    );
    expect(inScope.length).toBeGreaterThan(0);
    expect(inScope.every((call) => call.value.includes("AAAAA1"))).toBe(true);
    expect(inScope.every((call) => !call.value.includes("BBBBB2"))).toBe(true);
    expect(res.body.claims.map((row) => row.userId)).toEqual(["student-1"]);
  });
test("refuses the member list for an institution the caller does not administer", async () => {
    mockTables.institution_memberships = { rows: [], error: null };

    const res = await handleInstitutionAdminMembers(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(403);

    // Only the authorization lookup ran; the member list was never read.
    expect(callsFor("institution_memberships", "select").length).toBe(1);
    expect(scopeOn("institution_memberships", "user_id").length).toBe(1);
    expect(callsFor("profiles").length).toBe(0);
  });

  test("scopes the member list to the verified institution", async () => {
    mockTables.institution_memberships = {
      rows: [
        { id: "m1", user_id: "user-1", school_code: "AAAAA1", role: "institution_admin", status: "active" },
        { id: "m2", user_id: "student-1", school_code: "AAAAA1", role: "student", status: "active" },
        { id: "m3", user_id: "user-9", school_code: "BBBBB2", role: "student", status: "active" }
      ],
      error: null
    };
    mockTables.profiles = { rows: [{ id: "student-1", email: "student@example.test" }], error: null };

    const res = await handleInstitutionAdminMembers(context({ query: { schoolCode: "AAAAA1" } }));

    expect(res.status).toBe(200);
    const schoolScopes = scopeOn("institution_memberships", "school_code");
    expect(schoolScopes.length).toBeGreaterThan(0);
    expect(schoolScopes.every((call) => call.value === "AAAAA1")).toBe(true);

    // The authorization is resolved for the caller themselves.
    const userScope = scopeOn("institution_memberships", "user_id");
    expect(userScope.length).toBeGreaterThan(0);
    expect(userScope.every((call) => call.value === "user-1")).toBe(true);

    expect(res.body.members.map((row) => row.id)).toEqual(["m1", "m2"]);
  });

  test("serves a public directory of active institutions only", async () => {
    // The search route is deliberately unauthenticated: it is the directory a
    // student uses to find the institution to apply to, so it returns institution
    // names only and no member, class or settings data.
    mockTables.institutions = {
      rows: [
        { school_code: "AAAAA1", school_name: "Alpha University", active: true },
        { school_code: "INACTV", school_name: "Alpha College", active: false }
      ],
      error: null
    };

    const res = await handleInstitutionSearch(context({ query: { q: "alpha" } }));

    expect(res.status).toBe(200);
    expect(scopeOn("institutions", "active").map((call) => call.value)).toEqual([true]);
    expect(res.body.institutions.map((row) => row.schoolCode)).toEqual(["AAAAA1"]);
    expect(Object.keys(res.body.institutions[0]).sort()).toEqual([
      "city",
      "country",
      "schoolCode",
      "schoolName",
      "stateCode"
    ]);
  });
});



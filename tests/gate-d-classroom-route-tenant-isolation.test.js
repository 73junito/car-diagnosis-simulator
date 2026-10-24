"use strict";

/*
 * Runtime tenant-isolation test for the classroom routes.
 *
 * The classroom routes use a service-role Supabase client, which bypasses RLS, so
 * tenancy rests entirely on the route itself. The migration matrix proves the same
 * scoping at the query path; this proves the route handlers apply it, by driving
 * the real handlers and asserting that a caller cannot reach another instructor's
 * or another institution's data.
 *
 * The cases that matter: an instructor only ever sees classes they own; a class
 * owned by another instructor is refused before any roster or enrollment data is
 * read; a class cannot be created for an institution the caller has no active
 * membership in; the school code written on a new class comes from the verified
 * membership rather than from the request body; and the membership check completes
 * before any class data is touched.
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

// The stub applies the filters the route asked for, so a route that drops a scope
// sees the row it must not see, exactly as the database would hand it back. A stub
// that ignored the filters would make every scoping assertion pass vacuously.
function matchingRows(table, filters) {
  const entry = mockTables[table];
  if (!entry || !Array.isArray(entry.rows)) return [];

  return entry.rows.filter((row) =>
    filters.every((filter) => {
      if (filter.values) return filter.values.includes(row[filter.column]);
      return row[filter.column] === filter.value;
    })
  );
}

function mockQueryBuilder(table) {
  const builder = {
    op: null,
    filters: [],
    select: (columns) => {
      // An insert chain selects the created row, so the first operation wins and
      // the builder keeps reporting the insert result.
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
    order: (column) => {
      mockCalls.push({ table, op: "order", column });
      return builder;
    },
    insert: (payload) => {
      builder.op = "insert";
      mockCalls.push({ table, op: "insert", payload });
      return builder;
    },
    maybeSingle: () => {
      if (builder.op === "insert") {
        const config = configured(table, "insert");
        return Promise.resolve({ data: rowsOf(config)[0] || null, error: config.error || null });
      }
      const rows = matchingRows(table, builder.filters);
      return Promise.resolve({ data: rows[0] || null, error: mockTables[table]?.error || null });
    },
    single: () => {
      if (builder.op === "insert") {
        const config = configured(table, "insert");
        return Promise.resolve({ data: rowsOf(config)[0] || null, error: config.error || null });
      }
      const rows = matchingRows(table, builder.filters);
      return Promise.resolve({ data: rows[0] || null, error: mockTables[table]?.error || null });
    },
    then: (resolve, reject) => {
      if (builder.op === "insert") {
        const config = configured(table, "insert");
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
  handleListClasses,
  handleCreateClass,
  handleFindClassByCode,
  handleEnrollInClass,
  handleClassRoster
} = require("../worker/routes/classroom-classes.js");
const { handleCreateAssignment } = require("../worker/routes/classroom-assignments.js");

function context({ method = "GET", authorization = "Bearer token", params = {}, query = {}, body, env } = {}) {
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
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      ...env
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
describe("classroom routes: runtime tenant isolation", () => {
  beforeEach(() => {
    mockVerifySupabaseToken.mockReset();
    mockVerifySupabaseToken.mockResolvedValue({
      user: { id: "user-1", app_metadata: { role: "instructor" } },
      error: null
    });
    mockCalls.length = 0;

    for (const key of Object.keys(mockTables)) {
      delete mockTables[key];
    }
  });

  test("refuses a caller whose trusted role is not an instructor before reading class data", async () => {
    mockVerifySupabaseToken.mockResolvedValue({
      user: { id: "user-1", app_metadata: { role: "student" } },
      error: null
    });

    const res = await handleListClasses(context());

    expect(res.status).toBe(403);
    expect(callsFor("classes").length).toBe(0);
  });

  test("lists only the classes the caller owns", async () => {
    mockTables.classes = {
      rows: [
        {
          id: "class-a",
          name: "Class A",
          owner_id: "user-1",
          class_code: "AAAAAA",
          institution_school_code: "AAAAA1"
        },
        {
          id: "class-b",
          name: "Class B",
          owner_id: "user-2",
          class_code: "BBBBBB",
          institution_school_code: "BBBBB2"
        }
      ],
      error: null
    };

    const res = await handleListClasses(context());

    expect(res.status).toBe(200);

    // The owner scope is load-bearing: the service-role client bypasses RLS, so
    // without it the query would return every class of every institution.
    const ownerScope = scopeOn("classes", "owner_id");
    expect(ownerScope.length).toBeGreaterThan(0);
    expect(ownerScope.every((call) => call.value === "user-1")).toBe(true);

    // Sharing an institution is not enough to see a class, so the list is scoped
    // by owner and never widened by a school code.
    expect(scopeOn("classes", "institution_school_code").length).toBe(0);

    // Another instructor's class in another institution is not in the response.
    expect(res.body.classes.map((row) => row.id)).toEqual(["class-a"]);
  });

  test("refuses a roster for a class the caller does not own and reads no roster data", async () => {
    mockTables.classes = {
      rows: [{ id: "class-of-another-instructor", owner_id: "user-2" }],
      error: null
    };

    const res = await handleClassRoster(context({ params: { classId: "class-of-another-instructor" } }));

    expect(res.status).toBe(404);

    const ownerScope = scopeOn("classes", "owner_id");
    expect(ownerScope.length).toBeGreaterThan(0);
    expect(ownerScope.every((call) => call.value === "user-1")).toBe(true);

    // No enrollment or profile data may be read for a class the caller does not own.
    expect(callsFor("enrollments").length).toBe(0);
    expect(callsFor("profiles").length).toBe(0);
  });

  test("returns the roster for a class the caller owns", async () => {
    mockTables.classes = { rows: [{ id: "class-a", owner_id: "user-1" }], error: null };
    mockTables.enrollments = {
      rows: [{ user_id: "student-1", class_id: "class-a", created_at: "2026-01-01" }],
      error: null
    };
    mockTables.profiles = {
      rows: [{ id: "student-1", email: "student@example.test" }],
      error: null
    };

    const res = await handleClassRoster(context({ params: { classId: "class-a" } }));

    expect(res.status).toBe(200);
    expect(res.body.students).toEqual([
      { id: "student-1", email: "student@example.test", enrolled_at: "2026-01-01" }
    ]);
  });
test("refuses to create an assignment on a class the caller does not own", async () => {
    mockTables.classes = {
      rows: [{ id: "class-of-another-instructor", owner_id: "user-2" }],
      error: null
    };

    const res = await handleCreateAssignment(
      context({
        method: "POST",
        body: {
          system: "Automotive",
          scenarioIds: ["scenario-1"],
          classId: "class-of-another-instructor"
        }
      })
    );

    expect(res.status).toBe(404);
    expect(callsFor("enrollments").length).toBe(0);
    expect(callsFor("assignments", "insert").length).toBe(0);
  });

  test("creates an assignment for a class the caller owns", async () => {
    mockTables.classes = { rows: [{ id: "class-a", owner_id: "user-1" }], error: null };
    mockTables.assignments = {
      insert: {
        data: {
          id: "assignment-1",
          system: "Automotive",
          scenario_ids: ["scenario-1"],
          assigned_to: null,
          class_id: "class-a",
          created_at: "2026-01-01"
        },
        error: null
      }
    };

    const res = await handleCreateAssignment(
      context({
        method: "POST",
        body: { system: "Automotive", scenarioIds: ["scenario-1"], classId: "class-a" }
      })
    );

    expect(res.status).toBe(201);

    const insert = callsFor("assignments", "insert")[0];
    expect(insert.payload.class_id).toBe("class-a");
    expect(insert.payload.scenario_ids).toEqual(["scenario-1"]);
  });

  test("refuses to target a student who is not enrolled in the caller's class", async () => {
    mockTables.classes = { rows: [{ id: "class-a", owner_id: "user-1" }], error: null };
    mockTables.enrollments = {
      rows: [{ user_id: "student-1", class_id: "class-a" }],
      error: null
    };

    const res = await handleCreateAssignment(
      context({
        method: "POST",
        body: {
          system: "Automotive",
          scenarioIds: ["scenario-1"],
          classId: "class-a",
          studentIds: ["student-1", "student-of-another-class"]
        }
      })
    );

    expect(res.status).toBe(400);
    expect(callsFor("assignments", "insert").length).toBe(0);

    // The enrollment lookup is scoped to the caller's own class.
    const classScope = scopeOn("enrollments", "class_id");
    expect(classScope.length).toBeGreaterThan(0);
    expect(classScope.every((call) => call.value === "class-a")).toBe(true);
  });

test("refuses to create a class in an institution the caller has no active membership in", async () => {
    mockTables.institution_memberships = { rows: [], error: null };

    const res = await handleCreateClass(
      context({ method: "POST", body: { name: "Class A", schoolCode: "BBBBB2" } })
    );

    expect(res.status).toBe(403);
    expect(callsFor("classes", "insert").length).toBe(0);

    // The requested code is only ever checked against the caller's own
    // memberships, never used as a scope on its own.
    const membershipScope = scopeOn("institution_memberships", "user_id");
    expect(membershipScope.length).toBeGreaterThan(0);
    expect(membershipScope.every((call) => call.value === "user-1")).toBe(true);
    expect(scopeOn("institution_memberships", "school_code").map((call) => call.value)).toEqual([
      "BBBBB2"
    ]);
    expect(scopeOn("institution_memberships", "status").map((call) => call.value)).toEqual(["active"]);
  });

  test("writes the verified membership school code when the request supplies none", async () => {
    // The request carries no school code, so the class must be attributed to the
    // membership the server verified rather than to request input.
    mockTables.institution_memberships = {
      rows: [{ user_id: "user-1", school_code: "AAAAA1", role: "instructor", status: "active" }],
      error: null
    };
    mockTables.classes = {
      insert: {
        data: {
          id: "class-a",
          name: "Class A",
          owner_id: "user-1",
          class_code: "AAAAAA",
          institution_school_code: "AAAAA1"
        },
        error: null
      }
    };

    const res = await handleCreateClass(context({ method: "POST", body: { name: "Class A" } }));

    expect(res.status).toBe(201);

    const insert = callsFor("classes", "insert")[0];
    expect(insert.payload.institution_school_code).toBe("AAAAA1");
    expect(insert.payload.owner_id).toBe("user-1");
  });

  test("requires an explicit school code when the instructor belongs to several institutions", async () => {
    mockTables.institution_memberships = {
      rows: [
        { user_id: "user-1", school_code: "AAAAA1", role: "instructor", status: "active" },
        { user_id: "user-1", school_code: "CCCCC3", role: "instructor", status: "active" }
      ],
      error: null
    };

    const res = await handleCreateClass(context({ method: "POST", body: { name: "Class A" } }));

    expect(res.status).toBe(400);
    expect(callsFor("classes", "insert").length).toBe(0);
  });

  test("completes the membership check before reading or writing class data", async () => {
    mockTables.institution_memberships = {
      rows: [{ user_id: "user-1", school_code: "AAAAA1", role: "instructor", status: "active" }],
      error: null
    };
    mockTables.classes = {
      insert: {
        data: {
          id: "class-a",
          name: "Class A",
          owner_id: "user-1",
          class_code: "AAAAAA",
          institution_school_code: "AAAAA1"
        },
        error: null
      }
    };

    await handleCreateClass(context({ method: "POST", body: { name: "Class A", schoolCode: "AAAAA1" } }));

    const membershipIndex = mockCalls.findIndex((call) => call.table === "institution_memberships");
    const classIndex = mockCalls.findIndex((call) => call.table === "classes");

    expect(membershipIndex).toBeGreaterThanOrEqual(0);
    expect(classIndex).toBeGreaterThan(membershipIndex);
  });

  test("returns only the class id and name when a class is looked up by code", async () => {
    mockTables.classes = {
      rows: [
        {
          id: "class-a",
          name: "Class A",
          owner_id: "user-1",
          class_code: "AAAAAA",
          institution_school_code: "AAAAA1"
        }
      ],
      error: null
    };

    const res = await handleFindClassByCode(context({ params: { code: "AAAAAA" } }));

    expect(res.status).toBe(200);
    // The join-by-code path crosses institutions on purpose, so it must not carry
    // owner or institution detail into the response.
    expect(res.body.class).toEqual({ id: "class-a", name: "Class A" });
  });

  test("writes an enrollment for the authenticated caller only", async () => {
    mockTables.classes = { rows: [{ id: "class-a", class_code: "AAAAAA" }], error: null };
    mockTables.enrollments = {
      insert: {
        data: { id: "enrollment-1", class_id: "class-a", user_id: "user-1", created_at: "2026-01-01" },
        error: null
      }
    };

    const res = await handleEnrollInClass(
      context({ method: "POST", params: { classId: "class-a" }, body: { code: "AAAAAA" } })
    );

    expect(res.status).toBe(201);

    const insert = callsFor("enrollments", "insert")[0];
    expect(insert.payload).toEqual({ class_id: "class-a", user_id: "user-1" });
  });
});



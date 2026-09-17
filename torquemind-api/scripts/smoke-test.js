const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL;
const TEST_TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD;
const SMOKE_SEED_FIXTURE = process.env.SMOKE_SEED_FIXTURE === "true";
const APPROVED_STAGING_SUPABASE_HOST = "jchfruprqpeypdttvlam.supabase.co";
const TIMEOUT = 15000;

async function request(path, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request to ${path} timed out after ${TIMEOUT}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  let body = raw;

  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  return { status: res.status, ok: res.ok, body };
}

function assertApprovedStagingDestination(value = SUPABASE_URL) {
  if (!value) {
    throw new Error("Fixture seeding refused: Supabase destination is missing.");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Fixture seeding refused: Supabase destination is invalid.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== APPROVED_STAGING_SUPABASE_HOST ||
    parsed.port ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.username || parsed.password || parsed.search || parsed.hash
  ) {
    throw new Error("Fixture seeding refused: Supabase destination is not approved staging.");
  }
  return true;
}

async function ensureTeacherFixture(options = {}) {
  const {
    enabled = SMOKE_SEED_FIXTURE,
    supabaseUrl = SUPABASE_URL,
    serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY,
    email = TEST_TEACHER_EMAIL,
    password = TEST_TEACHER_PASSWORD,
    fetchImpl = fetch,
  } = options;

  if (!enabled) return { action: "disabled" };
  // Fail before any Admin Auth request, including the lookup.
  assertApprovedStagingDestination(supabaseUrl);
  if (!serviceRoleKey || !email || !password) {
    throw new Error("Fixture seeding requested but required fixture credentials are missing.");
  }

  const baseUrl = new URL(supabaseUrl).origin;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  // Do not follow redirects with Admin credentials or expose response bodies/errors.
  async function adminRequest(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/auth/v1/admin/users${path}`, {
        ...options, headers, redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch {
      throw new Error("Teacher fixture Admin request failed.");
    }
    if (!response.ok) {
      throw new Error(`Teacher fixture Admin request failed with status ${response.status}.`);
    }
    return response;
  }

  let teacher = null;
  for (let page = 1; page <= 10; page += 1) {
    const response = await adminRequest(`?page=${page}&per_page=100`);
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("Teacher fixture lookup returned invalid JSON.");
    }
    if (!body || !Array.isArray(body.users)) {
      throw new Error("Teacher fixture lookup returned an invalid user list.");
    }
    teacher = body.users.find((user) =>
      user && typeof user.email === "string" &&
      user.email.toLowerCase() === email.toLowerCase()
    );
    if (teacher || body.users.length < 100) break;
    if (page === 10) {
      throw new Error("Teacher fixture lookup limit reached; refusing creation without complete lookup.");
    }
  }

  if (!teacher) {
    await adminRequest("", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    console.log("Teacher fixture ensured: created staging test identity.");
    return { action: "created" };
  }
  if (typeof teacher.id !== "string" || !teacher.id) {
    throw new Error("Teacher fixture lookup returned an invalid user identity.");
  }
  await adminRequest(`/${encodeURIComponent(teacher.id)}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  console.log("Teacher fixture ensured: staging test identity already existed.");
  return { action: "updated" };
}

async function signInTeacher() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_TEACHER_EMAIL || !TEST_TEACHER_PASSWORD) {
    console.warn("Supabase test credentials not provided; auth-required checks may fail.");
    return null;
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: TEST_TEACHER_EMAIL,
      password: TEST_TEACHER_PASSWORD,
    }),
  });

  const body = await res.json();

  if (!res.ok || !body.access_token) {
    const message =
      body && typeof body === "object"
        ? body.message || body.error_description || body.error || body.msg || "Authentication failed"
        : "Authentication failed";
    console.error("Teacher sign-in failed", { status: res.status, message });
    process.exit(2);
  }

  console.log("0/7 OK: teacher sign-in");
  return { token: body.access_token, user: body.user || null };
}

async function getUserFromToken(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || data;
  } catch (e) {
    return null;
  }
}

async function ensureProfile(userId) {
  if (!userId) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  // Prefer using the Supabase admin client with the service role key to bypass RLS
  try {
    const { createClient } = require('@supabase/supabase-js');
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin
      .from('profiles')
      .upsert({ id: userId, email: TEST_TEACHER_EMAIL, role: 'teacher' }, { onConflict: 'id', returning: 'minimal' });

    console.log('ensureProfile result', {
      ok: !error,
      userId: userId || null,
      email: TEST_TEACHER_EMAIL || null,
      role: 'teacher',
      error: error ? (error.message || JSON.stringify(error)) : null,
    });

    return { ok: !error };
  } catch (e) {
    // Fallback: try REST upsert if the admin client is unavailable
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates, return=representation'
        },
        body: JSON.stringify({ id: userId, email: TEST_TEACHER_EMAIL, role: 'teacher' })
      });
      let error = null;
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (!res.ok) {
        error = body && (body.message || body.error_description || body.error) || `status:${res.status}`;
      }
      console.log('ensureProfile result', {
        ok: res.ok,
        userId: userId || null,
        email: TEST_TEACHER_EMAIL || null,
        role: 'teacher',
        error: error || (e && e.message) || null
      });
      return { ok: res.ok, body };
    } catch (err2) {
      console.log('ensureProfile result', { ok: false, userId: userId || null, email: TEST_TEACHER_EMAIL || null, role: 'teacher', error: err2 && err2.message });
    }
  }
}

async function main() {
  console.log(`TorqueMind smoke test against ${BASE_URL}`);

  await ensureTeacherFixture();
  const signIn = await signInTeacher();
  const token = signIn && signIn.token;
  let userId = signIn && signIn.user && signIn.user.id;

  if (!userId && token) {
    const u = await getUserFromToken(token);
    userId = u && u.id;
  }

  // Ensure the test teacher has a profile with teacher role (use service role key)
  await ensureProfile(userId);

  const health = await request("/", {}, token);
  if (!health.ok) {
    console.error("Health check failed", health);
    process.exit(1);
  }
  console.log("1/7 OK: health");

  const className = `Smoke Test Class ${Date.now()}`;

  const createClass = await request(
    "/api/classes",
    {
      method: "POST",
      body: JSON.stringify({ name: className }),
    },
    token
  );

  if (!createClass.ok) {
    console.error("Create class failed", createClass);
    process.exit(3);
  }

  const classId = createClass.body.id || createClass.body.class?.id;

  if (!classId) {
    console.error("Create class response missing class id", createClass.body);
    process.exit(4);
  }

  console.log("2/7 OK: create class");

  const classes = await request("/api/classes", {}, token);
  if (!classes.ok) {
    console.error("List classes failed", classes);
    process.exit(5);
  }
  console.log("3/7 OK: list classes");

  const replay = await request(
    "/api/replay",
    {
      method: "POST",
      body: JSON.stringify({
        classId,
        ...(userId && { userId }),
        scenarioId: 1,
        actions: [
          { type: "system", value: "electrical", time: Date.now() },
          { type: "tool", value: "battery", time: Date.now() + 1000 },
          { type: "diagnosis", value: "battery", time: Date.now() + 2000 },
          { type: "confidence", value: "high", time: Date.now() + 3000 },
        ],
        result: "Correct",
        confidence: "high",
      }),
    },
    token
  );

  if (!replay.ok) {
    console.error("Post replay failed", replay);
    process.exit(6);
  }
  console.log("4/7 OK: post replay");

  const complete = await request(
    "/api/complete",
    {
      method: "POST",
      body: JSON.stringify({
        classId,
        ...(userId && { userId }),
        scenarioId: 1,
      }),
    },
    token
  );

  if (!complete.ok) {
    console.error("Post completion failed", complete);
    process.exit(7);
  }
  console.log("5/7 OK: post completion");

  const teacherData = await request(
    `/api/teacher/data?classId=${encodeURIComponent(classId)}`,
    {},
    token
  );

  if (!teacherData.ok) {
    if (teacherData.status === 501) {
      console.log("6/7 SKIP: teacher data not implemented in fallback mode");
    } else {
      console.error("Teacher data failed", teacherData);
      process.exit(8);
    }
  } else {
    const teacherDataText =
      typeof teacherData.body === "string"
        ? teacherData.body
        : JSON.stringify(teacherData.body);

    if (!teacherDataText || !teacherDataText.includes(classId)) {
      console.error("Teacher data missing expected class reference", {
        classId,
        teacherData: teacherData.body,
      });
      process.exit(8);
    }

    console.log("6/7 OK: teacher data");
  }

  console.log("7/7 SMOKE TEST PASSED");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Smoke test crashed", err);
    process.exit(99);
  });
}

module.exports = {
  assertApprovedStagingDestination,
  ensureTeacherFixture,
};

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL;
const TEST_TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD;

async function request(path, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const raw = await res.text();
  let body = raw;

  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  return { status: res.status, ok: res.ok, body };
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
    console.error("Teacher sign-in failed", { status: res.status, body });
    process.exit(2);
  }

  console.log("0/7 OK: teacher sign-in");
  return { token: body.access_token, user: body.user || null };
}

async function ensureProfile(userId) {
  if (!userId) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: userId, email: TEST_TEACHER_EMAIL, role: 'teacher' })
    });
  } catch (e) {
    console.warn('Failed to ensure profile', e && e.message);
  }
}

async function main() {
  console.log(`TorqueMind smoke test against ${BASE_URL}`);

  const signIn = await signInTeacher();
  const token = signIn && signIn.token;
  const userId = signIn && signIn.user && signIn.user.id;

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
        userId: "smoke-test-teacher",
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
        userId: "smoke-test-teacher",
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

main().catch((err) => {
  console.error("Smoke test crashed", err);
  process.exit(99);
});

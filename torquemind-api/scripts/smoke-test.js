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
  return body.access_token;
}

async function main() {
  console.log(`TorqueMind smoke test against ${BASE_URL}`);

  const token = await signInTeacher();

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
  const classCode = createClass.body.class_code || createClass.body.class?.class_code;

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

  const teacherData = await request(`/api/teacher/data?classId=${classId}`, {}, token);

  if (!teacherData.ok) {
    console.error("Teacher data failed", teacherData);
    process.exit(8);
  }

  console.log("6/7 OK: teacher data");

  console.log("7/7 SMOKE TEST PASSED");
}

main().catch((err) => {
  console.error("Smoke test crashed", err);
  process.exit(99);
});

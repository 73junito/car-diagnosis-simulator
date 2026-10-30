const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL;
const TEST_TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD;
// A dedicated teacher identity belongs to exactly one workflow. When it is
// present it wins over the shared identity, so repairing it cannot revoke the
// sessions a sibling workflow is holding.
const DEDICATED_TEACHER_EMAIL = process.env.DEDICATED_TEACHER_EMAIL;
const DEDICATED_TEACHER_PASSWORD = process.env.DEDICATED_TEACHER_PASSWORD;
const SMOKE_SEED_FIXTURE = process.env.SMOKE_SEED_FIXTURE === "true";
const TEACHER_SCOPE_DEDICATED = "dedicated";
const TEACHER_SCOPE_SHARED_ISOLATED = "shared-isolated";
const TEACHER_SCOPE_SHARED = "shared";
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

/**
 * Checks whether the configured fixture credential still works, without mutating
 * anything. Returns one of:
 *   { status: "ok" }                     - sign-in succeeded; leave the account alone
 *   { status: "mismatch" }               - the provider explicitly rejected the credential
 *   { status: "unverifiable", reason }   - transient or configuration failure
 *
 * Anything that is not an explicit credential rejection is unverifiable: an outage,
 * a rate limit or a missing key is not evidence that the password is wrong.
 */
async function probeTeacherCredentials({ baseUrl, anonKey, email, password, fetchImpl = fetch }) {
  if (!anonKey) return { status: "unverifiable", reason: "SUPABASE_ANON_KEY is missing" };

  let response;
  try {
    response = await fetchImpl(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch (error) {
    return {
      status: "unverifiable",
      reason: `sign-in request failed: ${(error && error.message) || "unknown error"}`,
    };
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.ok && body && typeof body.access_token === "string" && body.access_token) {
    return { status: "ok" };
  }

  if (response.status === 429 || response.status >= 500) {
    return { status: "unverifiable", reason: `identity provider returned ${response.status}` };
  }

  if (response.status === 400 || response.status === 401) {
    const code = String((body && (body.error_code || body.error || body.code)) || "");
    const description = String((body && (body.error_description || body.msg || body.message)) || "");
    if (/invalid[_ ]?(credentials|grant|login|password)/i.test(`${code} ${description}`)) {
      return { status: "mismatch" };
    }
  }

  const detail =
    String(response.status) +
    (body && (body.msg || body.message) ? ` ${body.msg || body.message}` : "");
  return { status: "unverifiable", reason: `unexpected sign-in response (${detail})` };
}

async function ensureTeacherFixture(options = {}) {
  const {
    enabled = SMOKE_SEED_FIXTURE,
    supabaseUrl = SUPABASE_URL,
    serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY,
    anonKey = SUPABASE_ANON_KEY,
    email = TEST_TEACHER_EMAIL,
    password = TEST_TEACHER_PASSWORD,
    fetchImpl = fetch,
    allowPasswordReset = false,
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
  // Preserve valid credentials and every existing session without a write.
  const probe = await probeTeacherCredentials({ baseUrl, anonKey, email, password, fetchImpl });
  if (probe.status === "ok") {
    console.log("Teacher fixture ensured: existing credentials verified; nothing changed.");
    return { action: "preserved" };
  }
  if (probe.status !== "mismatch") {
    throw new Error(`Teacher fixture refused to rotate credentials: ${probe.reason}`);
  }
  if (!allowPasswordReset) {
    throw new Error(
      "Teacher fixture password reset refused: this run shares the staging teacher identity, and resetting its password revokes every session it holds."
    );
  }
  await adminRequest(`/${encodeURIComponent(teacher.id)}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  console.log("Teacher fixture ensured: credentials rejected; password reset for recovery.");
  return { action: "recovered" };
}

/**
 * Perform the teacher password grant without mutating any credential.
 *
 * Returns a discriminated result instead of terminating the process so that the
 * caller can decide whether the shared staging identity has to be repaired
 * first. See {@link resolveTeacherSession} for why that ordering matters.
 */
async function requestTeacherSignIn(options = {}) {
  const {
    supabaseUrl = SUPABASE_URL,
    anonKey = SUPABASE_ANON_KEY,
    email = TEST_TEACHER_EMAIL,
    password = TEST_TEACHER_PASSWORD,
    fetchImpl = fetch,
  } = options;

  if (!supabaseUrl || !anonKey || !email || !password) {
    return {
      ok: false,
      credentialsMissing: true,
      status: null,
      message: "Supabase test credentials not provided.",
    };
  }

  const res = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const body = await res.json();

  if (!res.ok || !body.access_token) {
    const message =
      body && typeof body === "object"
        ? body.message || body.error_description || body.error || body.msg || "Authentication failed"
        : "Authentication failed";
    return { ok: false, credentialsMissing: false, status: res.status, message };
  }

  return {
    ok: true,
    credentialsMissing: false,
    status: res.status,
    message: null,
    token: body.access_token,
    user: body.user || null,
  };
}

/**
 * Resolve the teacher identity this run is allowed to use.
 *
 * Three scopes are possible:
 *
 * - `dedicated`: the workflow owns a disposable identity of its own. Repairing
 *   it cannot revoke a session another workflow is holding, so the repair is
 *   allowed.
 * - `shared-isolated`: the workflow fell back to the shared identity but opted
 *   into isolation. The shared identity is used by several workflows (and by
 *   the production sign-in workflows), so it must never be repaired from a
 *   workflow run: GoTrue revokes every session the user holds when the
 *   password changes. The run fails loudly instead.
 * - `shared`: legacy behaviour. The shared identity is repaired as before.
 *
 * @returns {{email: string, password: string, scope: string}}
 */
function resolveTeacherCredentials(env = process.env) {
  const dedicatedEmail = (env.DEDICATED_TEACHER_EMAIL || "").trim();
  const dedicatedPassword = env.DEDICATED_TEACHER_PASSWORD || "";
  const sharedEmail = (env.TEST_TEACHER_EMAIL || "").trim();
  const sharedPassword = env.TEST_TEACHER_PASSWORD || "";
  const isolated = env.SMOKE_TEACHER_ISOLATED === "true";

  if (dedicatedEmail && !dedicatedPassword) {
    throw new Error(
      "Dedicated teacher credentials are incomplete: DEDICATED_TEACHER_EMAIL was provided without DEDICATED_TEACHER_PASSWORD."
    );
  }
  if (!dedicatedEmail && dedicatedPassword) {
    throw new Error(
      "Dedicated teacher credentials are incomplete: DEDICATED_TEACHER_PASSWORD was provided without DEDICATED_TEACHER_EMAIL."
    );
  }

  if (dedicatedEmail && dedicatedPassword) {
    return {
      email: dedicatedEmail,
      password: dedicatedPassword,
      scope: TEACHER_SCOPE_DEDICATED,
    };
  }

  return {
    email: sharedEmail,
    password: sharedPassword,
    scope: isolated ? TEACHER_SCOPE_SHARED_ISOLATED : TEACHER_SCOPE_SHARED,
  };
}

/**
 * Resolve a signed-in teacher session for this run.
 *
 * The two staging smoke workflows run concurrently against the same staging
 * project and share one teacher identity. `ensureTeacherFixture()` resets that
 * identity's password through the Admin API, and GoTrue revokes *every* session
 * that user holds when a password changes (`User.UpdatePassword` -> `Logout` ->
 * `DELETE FROM auth.sessions WHERE user_id = ?`). Resetting the password on
 * every run therefore invalidated the access token of the concurrently running
 * sibling workflow, whose next authenticated request then failed with
 * `401 Invalid or expired token` (GoTrue `session_not_found`).
 *
 * Signing in first keeps the destructive reset off the healthy path: the
 * identity is only repaired when the stored credential is actually unusable.
 */
async function resolveTeacherSession(options = {}) {
  const {
    requestSignIn = requestTeacherSignIn,
    ensureFixture = ensureTeacherFixture,
    mayResetPassword = true,
  } = options;

  const result = await requestSignIn();

  if (result.ok) return result;

  // Missing credentials are a configuration error. Run the fixture step so the
  // misconfiguration fails loudly, exactly as it did before.
  if (result.credentialsMissing) {
    await ensureFixture({ allowPasswordReset: mayResetPassword });
    return result;
  }

  // Only a deterministic credential rejection (HTTP 400) means the stored
  // identity is unusable. A transient failure (rate limit, upstream 5xx,
  // network error) must not trigger the repair: the Admin password reset
  // revokes every session the shared identity holds, so a transient blip would
  // break a concurrently running sibling smoke workflow that is signed in.
  if (result.status !== 400) return result;

  if (!mayResetPassword) {
    // The identity is shared with at least one sibling workflow. Creating it is
    // harmless, but resetting the password would revoke every session it holds
    // and break the sibling run, so the repair is refused and the rejection is
    // reported with the remediation instead.
    let fixture;
    try {
      fixture = await ensureFixture({ allowPasswordReset: false });
    } catch (err) {
      return {
        ...result,
        repairRefused: true,
        message: `Teacher sign-in was rejected and the shared staging teacher identity was not repaired: ${err.message} Provision dedicated teacher credentials for this workflow.`,
      };
    }
    if (fixture && fixture.action === "created") {
      return requestSignIn();
    }
    return {
      ...result,
      repairRefused: true,
      message:
        "Teacher sign-in was rejected and the shared staging teacher identity was not repaired: resetting its password revokes every session it holds, including the sessions a sibling smoke workflow is using. Provision dedicated teacher credentials for this workflow.",
    };
  }

  const fixture = await ensureFixture({ allowPasswordReset: mayResetPassword });

  // A disabled fixture cannot repair anything, so retrying would only repeat
  // the same rejected request.
  if (fixture && fixture.action === "disabled") return result;

  return requestSignIn();
}

async function getUserFromToken(token, options = {}) {
  const {
    supabaseUrl = SUPABASE_URL,
    anonKey = SUPABASE_ANON_KEY,
    fetchImpl = fetch,
  } = options;
  if (!token || !supabaseUrl || !anonKey) return null;
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anonKey,
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

async function ensureProfile(userId, options = {}) {
  const { email = TEST_TEACHER_EMAIL } = options;
  if (!userId) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  // Prefer using the Supabase admin client with the service role key to bypass RLS
  try {
    const { createClient } = require('@supabase/supabase-js');
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await admin
      .from('profiles')
      .upsert({ id: userId, email, role: 'teacher' }, { onConflict: 'id', returning: 'minimal' });

    console.log('ensureProfile result', {
      ok: !error,
      userId: userId || null,
      email: email || null,
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
        body: JSON.stringify({ id: userId, email, role: 'teacher' })
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
        email: email || null,
        role: 'teacher',
        error: error || (e && e.message) || null
      });
      return { ok: res.ok, body };
    } catch (err2) {
      console.log('ensureProfile result', { ok: false, userId: userId || null, email: email || null, role: 'teacher', error: err2 && err2.message });
    }
  }
}

let activeSmokeClass = null;

async function cleanupSmokeClass(options = {}) {
  const {
    classId,
    className,
    userId,
    supabaseUrl = SUPABASE_URL,
    serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY,
    createClientImpl,
  } = options;

  if (!classId || String(classId).startsWith('local-')) return { action: 'local-noop' };
  if (!/^Smoke Test Class \d+$/.test(className || '')) {
    throw new Error('Smoke cleanup refused: class name is not an exact smoke-test fixture.');
  }
  if (!userId) throw new Error('Smoke cleanup refused: class owner is missing.');
  assertApprovedStagingDestination(supabaseUrl);
  if (!serviceRoleKey) throw new Error('Smoke cleanup refused: service-role credential is missing.');

  const createClient = createClientImpl || require('@supabase/supabase-js').createClient;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from('classes')
    .delete()
    .eq('id', classId)
    .eq('owner_id', userId)
    .eq('name', className)
    .select('id');

  if (error) throw new Error('Smoke cleanup failed to delete the exact test class.');
  if (!Array.isArray(data) || data.length !== 1 || data[0].id !== classId) {
    throw new Error('Smoke cleanup refused: exact test class was not uniquely deleted.');
  }
  return { action: 'deleted', classId };
}

async function cleanupActiveSmokeClass() {
  if (!activeSmokeClass) return { action: 'none' };
  const target = activeSmokeClass;
  activeSmokeClass = null;
  return cleanupSmokeClass(target);
}

async function main() {
  console.log(`TorqueMind smoke test against ${BASE_URL}`);

  const credentials = resolveTeacherCredentials();
  // A shared identity must not be repaired from a workflow run: resetting the
  // password revokes every session it holds, including the sessions a sibling
  // workflow and the production sign-in workflows are using.
  const mayResetPassword = credentials.scope !== TEACHER_SCOPE_SHARED_ISOLATED;

  if (credentials.scope === TEACHER_SCOPE_DEDICATED) {
    console.log(`Teacher identity: dedicated (${credentials.email}).`);
  } else if (mayResetPassword) {
    console.log(`Teacher identity: shared (${credentials.email || "unset"}).`);
  } else {
    console.warn(
      `Teacher identity: shared fallback (${credentials.email || "unset"}). This run may not reset the teacher password, because that would revoke the sessions a sibling smoke workflow is holding. Provision dedicated teacher credentials for full isolation.`
    );
  }

  const signIn = await resolveTeacherSession({
    requestSignIn: () =>
      requestTeacherSignIn({
        email: credentials.email,
        password: credentials.password,
      }),
    ensureFixture: (options = {}) =>
      ensureTeacherFixture({
        ...options,
        email: credentials.email,
        password: credentials.password,
      }),
    mayResetPassword,
  });

  if (!signIn.ok) {
    if (signIn.credentialsMissing) {
      console.warn("Supabase test credentials not provided; auth-required checks may fail.");
    } else {
      console.error("Teacher sign-in failed", { status: signIn.status, message: signIn.message });
      process.exit(2);
    }
  } else {
    console.log("0/7 OK: teacher sign-in");
  }

  const token = signIn.token;
  let userId = signIn.user && signIn.user.id;

  if (!userId && token) {
    const u = await getUserFromToken(token);
    userId = u && u.id;
  }

  // Ensure the test teacher has a profile with teacher role (use service role key)
  await ensureProfile(userId, { email: credentials.email });

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

  activeSmokeClass = {
    classId,
    className,
    userId,
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log("2/7 OK: create class");

  const classes = await request("/api/classes", {}, token);
  if (!classes.ok) {
    console.error("List classes failed", classes);
    await cleanupActiveSmokeClass();
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
    await cleanupActiveSmokeClass();
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
    await cleanupActiveSmokeClass();
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
      await cleanupActiveSmokeClass();
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
      await cleanupActiveSmokeClass();
      process.exit(8);
    }

    console.log("6/7 OK: teacher data");
  }

  console.log("7/7 SMOKE TEST PASSED");
  await cleanupActiveSmokeClass();
}

if (require.main === module) {
  main().catch(async (err) => {
    try {
      await cleanupActiveSmokeClass();
    } catch (cleanupError) {
      console.error("Smoke class cleanup also failed", cleanupError);
    }
    console.error("Smoke test crashed", err);
    process.exit(99);
  });
}

module.exports = {
  assertApprovedStagingDestination,
  probeTeacherCredentials,
  ensureTeacherFixture,
  getUserFromToken,
  cleanupSmokeClass,
  requestTeacherSignIn,
  resolveTeacherSession,
  resolveTeacherCredentials,
  TEACHER_SCOPE_DEDICATED,
  TEACHER_SCOPE_SHARED_ISOLATED,
  TEACHER_SCOPE_SHARED,
};

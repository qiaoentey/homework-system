# Shared Password Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sites ChatGPT account gate with one application-owned shared password while keeping every roster read and write operation authenticated.

**Architecture:** Static assets remain publicly loadable so the password screen can render, but the Cloudflare Worker rejects all protected API routes unless a signed, HTTP-only session cookie is valid. Password digests and the cookie-signing secret live only in Sites environment variables; D1 stores bounded failed-login counters. The existing Express runtime exposes the same password endpoint so local and end-to-end behavior remains aligned.

**Tech Stack:** React 18, Vite 6, Cloudflare Worker Web Crypto, D1/SQLite migrations, Node test runner, Vitest, Playwright, Sites hosting.

## Global Constraints

- Teachers must not need a ChatGPT or Google account.
- The login UI contains one field labelled `系统密码`.
- Static assets and `GET /api/health` may be public; every student-data read or write requires a valid session.
- Session cookie: `__Host-daycare_session`, HttpOnly, Secure, SameSite=Strict, Path=/, 12-hour maximum age.
- Password digest and session-signing secret are Sites secrets and never enter Git.
- Five failed attempts within 15 minutes lock the address for 15 minutes.
- Preserve the existing Sites URL and all MK/STP/WS roster behavior.

---

## File responsibility map

- `worker/auth.js`: password hashing, signed-cookie creation/verification, cookie headers, and D1-backed login throttling.
- `worker/index.js`: public authentication routes, protected API guard, and existing daycare endpoints.
- `drizzle/0002_shared_password_access.sql`: D1 table for failed-login counters.
- `drizzle/meta/_journal.json`: migration order.
- `db/schema.ts`: declared login-attempt table shape packaged with the site.
- `scripts/prepare-sites-build.mjs`: copy the Worker module directory so `auth.js` ships with `index.js`.
- `src/features/auth/LoginScreen.jsx`: shared-password-only login screen.
- `src/App.jsx` and `src/api/client.js`: password session client flow.
- `server/routes/session.js`: matching `/api/session/password` route for local and E2E use.
- `tests/sites-worker.test.mjs`: Worker authentication, route guard, cookies, throttling, and packaging contract.
- `tests/client/branch-flow.test.jsx`: password-only UI and retry behavior.
- `tests/server/session.test.js`: Express password endpoint compatibility.
- `tests/e2e/daycare.spec.js`: end-to-end password login and logout.

---

### Task 1: Worker authentication primitives and migration

**Files:**
- Create: `worker/auth.js`
- Create: `drizzle/0002_shared_password_access.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `db/schema.ts`
- Test: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: Worker environment keys `ACCESS_PASSWORD_SHA256`, `ACCESS_SESSION_SECRET`, and `DB`.
- Produces:
  - `authenticatePassword(request, env, now?) -> Promise<Response>`
  - `readSession(request, env, now?) -> Promise<{ email: string } | null>`
  - `sessionCookie(value, maxAge) -> string`
  - `clearSessionCookie() -> string`

- [ ] **Step 1: Write failing Worker authentication tests**

Add fixed test secrets and helpers:

```js
const TEST_PASSWORD = "Teacher-Access-2026";
const TEST_PASSWORD_SHA256 =
  "65e22250c5caa9cd6cfd98ec3f07f32834141d3c86ff0637cdc271c703aec702";
const TEST_SESSION_SECRET = "test-session-secret-with-at-least-32-random-bytes";

function workerEnv(env = {}) {
  return {
    ASSETS: noAssetFallback,
    ACCESS_PASSWORD_SHA256: TEST_PASSWORD_SHA256,
    ACCESS_SESSION_SECRET: TEST_SESSION_SECRET,
    ...env,
  };
}
```

Cover:

```js
test("accepts the shared password and issues a secure host-only cookie", async () => {
  await withD1(async ({ DB }) => {
    const response = await worker.fetch(
      new Request("https://example.test/api/session/password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ password: TEST_PASSWORD }),
      }),
      workerEnv({ DB }),
    );
    assert.equal(response.status, 204);
    assert.match(response.headers.get("set-cookie"), /__Host-daycare_session=/u);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/u);
    assert.match(response.headers.get("set-cookie"), /Secure/u);
    assert.match(response.headers.get("set-cookie"), /SameSite=Strict/u);
    assert.match(response.headers.get("set-cookie"), /Max-Age=43200/u);
  });
});
```

Also assert incorrect passwords return `401`, the fifth failure returns `429`
with `Retry-After`, a success clears prior failures, and missing secrets fail
closed with `503`.

- [ ] **Step 2: Run the Worker test and verify it fails**

Run:

```bash
npm run test:sites
```

Expected: FAIL because `/api/session/password` and the login-attempt table do not exist.

- [ ] **Step 3: Add the D1 migration**

Create `drizzle/0002_shared_password_access.sql`:

```sql
CREATE TABLE IF NOT EXISTS access_login_attempts (
  address_hash TEXT PRIMARY KEY NOT NULL,
  failures INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS access_login_attempts_updated_at_idx
  ON access_login_attempts (updated_at);
```

Append an `idx: 2`, `version: "6"`, `tag: "0002_shared_password_access"`,
`breakpoints: true` entry to the journal. Add the same table and index to
`db/schema.ts` using the file's existing Drizzle SQLite conventions.

- [ ] **Step 4: Implement `worker/auth.js`**

Use Web Crypto and no new dependency:

```js
export const SESSION_COOKIE = "__Host-daycare_session";
export const SHARED_OPERATOR_EMAIL = "shared-access@local";
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
```

Implement SHA-256 hex digesting, base64url encoding/decoding, constant-time byte
comparison, HMAC-SHA-256 signing, cookie parsing, and signed payload validation.
The payload is exactly:

```js
{ email: SHARED_OPERATOR_EMAIL, exp: Math.floor(now / 1000) + SESSION_SECONDS }
```

`authenticatePassword` must:

1. require `DB`, a 64-character lowercase hex digest, and a signing secret of at
   least 32 characters;
2. reject bodies other than `{ password: string }` or passwords over 128
   characters with `400`;
3. hash the Cloudflare client address before storing it;
4. clean rows older than seven days;
5. return `429` while `locked_until > now`;
6. record a failure and lock on attempt five;
7. delete the row after a successful password;
8. issue the signed cookie.

- [ ] **Step 5: Run the focused Worker tests**

Run:

```bash
npm run test:sites
```

Expected: new authentication and migration tests PASS; existing private-session
tests may still fail until Task 2 replaces them.

- [ ] **Step 6: Commit Task 1**

```bash
git add worker/auth.js drizzle/0002_shared_password_access.sql drizzle/meta/_journal.json db/schema.ts tests/sites-worker.test.mjs
git commit -m "feat: add shared password sessions"
```

---

### Task 2: Protect every Sites API route and package the auth module

**Files:**
- Modify: `worker/index.js`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: `authenticatePassword`, `readSession`, `sessionCookie`,
  `clearSessionCookie`, and `SHARED_OPERATOR_EMAIL` from `worker/auth.js`.
- Produces: authenticated `/api/session`, `/api/session/password`, logout, and
  a single fail-closed guard for all remaining `/api/*` routes.

- [ ] **Step 1: Replace the private-Sites test assumptions with failing access-guard tests**

Add a `loginCookie(DB)` helper that posts the test password and returns only the
cookie name/value. Test:

```js
test("rejects protected reads and writes without a password session", async () => {
  await withD1(async ({ DB }) => {
    for (const [path, method] of [
      ["/api/catalog", "GET"],
      ["/api/students?branch=MK&group=MK%20HAPPY&status=active", "GET"],
      ["/api/students", "POST"],
    ]) {
      const response = await worker.fetch(
        new Request(`https://example.test${path}`, { method }),
        workerEnv({ DB }),
      );
      assert.equal(response.status, 401);
    }
  });
});
```

Also test valid cookies unlock catalog and D1 routes, tampered cookies return
`401`, logout sends `Max-Age=0`, `GET /api/health` remains public, and obsolete
Google/emergency session routes return `404`.

- [ ] **Step 2: Run the access-guard tests and verify they fail**

Run:

```bash
npm run test:sites
```

Expected: FAIL because catalog and student APIs are still public.

- [ ] **Step 3: Implement the Worker route guard**

At the start of `handleApi`:

```js
if (pathname === "/api/health" && request.method === "GET") return json({ ok: true });
if (pathname === "/api/session/password" && request.method === "POST") {
  return authenticatePassword(request, env);
}

const identity = await readSession(request, env);
if (!identity) return apiError(401, "AUTHENTICATION_REQUIRED", "Authentication required");

if (pathname === "/api/session" && request.method === "GET") return json(identity);
if (pathname === "/api/session" && request.method === "DELETE") {
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": clearSessionCookie() },
  });
}
```

Remove the ChatGPT header fallback and both no-op Google/emergency routes.
Keep `operator()` deterministic as `{ email: SHARED_OPERATOR_EMAIL }` after the
guard succeeds so attendance and message audit columns remain populated.

- [ ] **Step 4: Package every Worker module**

Replace the single-file copy in `scripts/prepare-sites-build.mjs` with:

```js
const worker = path.join(root, "worker");
rmSync(path.join(dist, "server"), { recursive: true, force: true });
cpSync(worker, path.join(dist, "server"), { recursive: true });
```

Extend the packaging test to require both `dist/server/index.js` and
`dist/server/auth.js`.

- [ ] **Step 5: Run Worker tests and build**

Run:

```bash
npm run test:sites
npm run build
```

Expected: all Sites tests PASS and both Worker modules exist in `dist/server`.

- [ ] **Step 6: Commit Task 2**

```bash
git add worker/index.js scripts/prepare-sites-build.mjs tests/sites-worker.test.mjs
git commit -m "fix: require password session for Sites APIs"
```

---

### Task 3: Replace Google/emergency UI with one system-password login

**Files:**
- Modify: `src/features/auth/LoginScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/api/client.js`
- Modify: `src/styles/app.css`
- Modify: `server/routes/session.js`
- Test: `tests/client/branch-flow.test.jsx`
- Test: `tests/server/session.test.js`
- Test: `tests/e2e/daycare.spec.js`

**Interfaces:**
- Consumes: `POST /api/session/password` with `{ password: string }`.
- Produces: `sessionApi.passwordLogin(password)` and
  `<LoginScreen onPasswordLogin={...} />`.

- [ ] **Step 1: Write failing client and server tests**

Client test:

```jsx
it("shows one account-free system password login and clears failed input", async () => {
  // GET /api/session returns 401.
  // POST /api/session/password captures { password: "private-access" } and returns 401.
  // Assert no Google login region exists.
  // Assert label "系统密码", button "登录", disabled duplicate submit,
  // generic "密码错误，请重试", and cleared password after failure.
});
```

Server test:

```js
it("creates the existing secure session through the password endpoint", async () => {
  const agent = request.agent(createTestApp());
  await agent.post("/api/session/password")
    .send({ password: "test-access" })
    .expect(204);
  await agent.get("/api/session").expect(200);
});
```

Update E2E `login(page)` to fill `系统密码` and click `登录`.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- --run tests/client/branch-flow.test.jsx tests/server/session.test.js
```

Expected: FAIL because the UI and API client still use Google/emergency routes.

- [ ] **Step 3: Implement the password-only client**

In `src/api/client.js`:

```js
passwordLogin: (password) => apiRequest("/api/session/password", {
  method: "POST",
  body: { password },
}),
```

In `App.jsx`, replace both login callbacks with `loginWithPassword` and pass
`onPasswordLogin`.

In `LoginScreen.jsx`, remove Google script loading, the Google button, the
divider, and all Google-specific refs. Keep the in-flight ref, mounted ref, and
failure recovery. Required copy:

```jsx
<h1>登录点名系统</h1>
<p>请输入系统密码</p>
<label htmlFor="access-password">系统密码</label>
<button type="submit">{pending ? "登录中…" : "登录"}</button>
```

Use `密码错误，请重试` for failed login. Remove now-unused Google/divider CSS
without changing the established card layout.

- [ ] **Step 4: Add the Express compatibility endpoint**

Extract the current emergency-password handler into one local function and
mount it for both routes:

```js
router.post("/password", passwordLogin);
router.post("/emergency", passwordLogin);
```

Keep `/emergency` only for backward compatibility with any old Render clients;
the new UI uses `/password`.

- [ ] **Step 5: Run client, server, and E2E tests**

Run:

```bash
npm test
npm run test:e2e
```

Expected: all unit/component/server tests and all desktop/mobile E2E tests PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/features/auth/LoginScreen.jsx src/App.jsx src/api/client.js src/styles/app.css server/routes/session.js tests/client/branch-flow.test.jsx tests/server/session.test.js tests/e2e/daycare.spec.js
git commit -m "feat: use account-free system password login"
```

---

### Task 4: Full verification and safe public rollout

**Files:**
- Modify only if verification reveals a scoped defect.
- Package: exact validated `dist/`, `.openai/hosting.json`, D1 migrations, and schema.

**Interfaces:**
- Consumes: existing Sites project, D1 binding `DB`, and approved owner-only deployment.
- Produces: the same production URL without a ChatGPT gate and a generated shared password.

- [ ] **Step 1: Run the complete verification suite**

Run:

```bash
npm test
npm run test:sites
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 2: Generate deployment secrets without writing plaintext to disk**

Generate:

- a readable random shared password with at least 16 characters;
- `ACCESS_PASSWORD_SHA256` from its exact UTF-8 bytes;
- an independent 48-byte random `ACCESS_SESSION_SECRET`.

Keep the plaintext password only in memory for the final owner handoff. Store
the digest and session secret as secret Sites environment variables.

- [ ] **Step 3: Build, package, save, and privately deploy the exact commit**

Commit the verified source, push that exact `HEAD`, package it with the Sites
packaging helper, save one new site version, and deploy it while access is still
owner-only. Poll until status is `succeeded`.

- [ ] **Step 4: Verify protection before changing access**

Confirm the private deployment reports:

- `GET /api/health` → `200`;
- unauthenticated `GET /api/catalog` → `401`;
- correct password → secure cookie → catalog `200`;
- Worker logs contain no `500` events.

- [ ] **Step 5: Remove the ChatGPT gate**

Change the existing Sites access policy to `public` only after Step 4 passes.
Do not create a second site and do not change the slug or URL.

- [ ] **Step 6: Run public production smoke tests**

In a fresh unauthenticated browser context:

1. open the production URL and confirm the system-password screen appears
   without a ChatGPT sign-in page;
2. confirm a wrong password shows the generic error;
3. enter the generated password and confirm MK/STP/WS appears;
4. open one teacher group and confirm the roster loads;
5. logout and confirm the password screen returns;
6. inspect Worker error logs for `500` responses.

- [ ] **Step 7: Handoff**

Return:

- the unchanged production URL;
- the generated shared password;
- a warning to share the password only with authorized teachers;
- confirmation that no ChatGPT or Google account is needed.

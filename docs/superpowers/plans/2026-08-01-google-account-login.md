# Google Account Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared-password production entrance with Google Identity Services and permit only `qiaoen9816@gmail.com`.

**Architecture:** The client loads its public Google client ID from the server, renders Google's official button, and posts the returned ID token to the Sites Worker. The Worker verifies the signed JWT with `jose`, checks issuer, audience, expiry, verified email, and the exact allowlist, then issues the existing secure host-only session cookie containing the verified email. A bundled Worker build keeps the Sites artifact self-contained.

**Tech Stack:** React 19, Google Identity Services, Cloudflare Workers Web Crypto, `jose`, Vite 6, Node test runner, Vitest, Playwright, Sites/D1

## Global Constraints

- The only allowed Google email is exactly `qiaoen9816@gmail.com` after trimming and lowercasing.
- The existing production URL remains `https://daycare-checkin-optimized.cyedu111.chatgpt.site`.
- The login screen contains one Google sign-in button and no password field.
- Existing MK, STP, and WS branch, teacher, roster, attendance, profile, message, enrolment, stop, and restore behavior remains unchanged.
- Application sessions remain HTTP-only, Secure, SameSite=Strict, host-only, and expire after 12 hours.
- Production password and emergency login routes return 404.
- Login errors are generic and do not disclose whether the token or email was rejected.
- Google Identity Services uses the existing web client ID `632635821776-c0061mkerfjre56rivsfli72l7re1a28.apps.googleusercontent.com`.
- Follow Google's server-side ID-token checks: signature, issuer, audience, expiry, and `email_verified`.

---

## File Structure

- Modify `worker/auth.js`: Google JWT verification, exact-email authorization, signed user session creation and reading.
- Modify `worker/index.js`: public Google configuration/login routes and verified-email audit propagation.
- Modify `tests/sites-worker.test.mjs`: real signed-JWT authentication and Worker route regression coverage.
- Modify `src/features/auth/LoginScreen.jsx`: Google Identity Services script lifecycle and single-button UI.
- Modify `src/App.jsx`: load public auth configuration and submit Google credentials.
- Modify `src/api/client.js`: Google configuration and login API methods.
- Modify `tests/client/branch-flow.test.jsx`: Google button, credential, script-error, and no-password tests.
- Modify `server/routes/session.js`: local/Render public Google configuration route while retaining its existing Google verifier.
- Modify `tests/server/session.test.js`: configuration-route and Google-only client compatibility tests.
- Create `vite.worker.config.mjs`: bundle the Worker and `jose` into one Sites entry module.
- Modify `scripts/prepare-sites-build.mjs`: preserve the bundled Worker instead of copying unbundled source.
- Modify `package.json` and `package-lock.json`: add `jose` and run the Worker bundle build.
- Modify `tests/sites-worker.test.mjs`: verify the self-contained packaged Worker artifact.

---

### Task 1: Verify Google ID Tokens and Create User Sessions

**Files:**
- Modify: `worker/auth.js`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_EMAIL`, and `ACCESS_SESSION_SECRET` Worker environment values.
- Produces: `verifyGoogleCredential(credential, options) -> Promise<{ email: string, sub: string }>`; `authenticateGoogle(request, env, options?) -> Promise<Response>`; `readSession(request, env, now?) -> Promise<{ email: string } | null>`.

- [ ] **Step 1: Install the Worker-compatible JWT library**

Run:

```bash
npm install jose@6.2.6
```

Expected: `package.json` and `package-lock.json` record exact version `6.2.6`.

- [ ] **Step 2: Write failing real-JWT tests**

Add test helpers using `jose` rather than a verifier mock:

```js
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";

const TEST_GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
const TEST_ALLOWED_EMAIL = "qiaoen9816@gmail.com";

async function googleFixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-google-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  const sign = ({
    email = TEST_ALLOWED_EMAIL,
    emailVerified = true,
    audience = TEST_GOOGLE_CLIENT_ID,
    issuer = "https://accounts.google.com",
    expiresIn = "5m",
  } = {}) => new SignJWT({ email, email_verified: emailVerified })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setSubject("google-user-123")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
  return { jwks, sign };
}
```

Cover all of these behaviors:

```js
test("accepts a signed Google ID token for the only allowed verified email", async () => {});
test("rejects a valid Google token for another email with a generic response", async () => {});
test("rejects unverified email, wrong audience, wrong issuer, expiry, and bad signature", async () => {});
test("rejects malformed Google login bodies and missing auth configuration", async () => {});
test("reads the verified Google email from a signed 12-hour session", async () => {});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern='Google ID token|Google token|Google login bodies|verified Google email' tests/sites-worker.test.mjs
```

Expected: FAIL because `authenticateGoogle` and `verifyGoogleCredential` do not exist and password-only sessions hardcode `shared-access@local`.

- [ ] **Step 4: Implement Google verification and email-bound sessions**

Add Google-specific configuration beside the existing password helper so the Worker remains runnable until Task 2 removes the password route. Replace the hardcoded session-email payload logic with an email parameter and add:

```js
import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function normalizedEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validConfiguration(env) {
  return Boolean(
    typeof env?.GOOGLE_CLIENT_ID === "string"
    && env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
    && normalizedEmail(env.GOOGLE_ALLOWED_EMAIL)
    && typeof env.ACCESS_SESSION_SECRET === "string"
    && env.ACCESS_SESSION_SECRET.length >= 32,
  );
}

export async function verifyGoogleCredential(credential, {
  clientId,
  jwks = GOOGLE_JWKS,
  now = Date.now(),
} = {}) {
  const { payload } = await jwtVerify(credential, jwks, {
    algorithms: ["RS256"],
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
    currentDate: new Date(now),
  });
  const email = normalizedEmail(payload.email);
  if (!email || payload.email_verified !== true || typeof payload.sub !== "string") {
    throw new Error("Invalid Google identity claims");
  }
  return { email, sub: payload.sub };
}
```

Make `signedSession(secret, email, now)` encode `{ email, exp }`. During this transitional task, make `readSession` accept either normalized `env.GOOGLE_ALLOWED_EMAIL` or the existing shared operator only when the matching authentication configuration exists; Task 2 removes the shared path. Implement exact `{ credential }` request parsing and return one `401 INVALID_GOOGLE_LOGIN` response for every invalid, unverified, or disallowed identity.

- [ ] **Step 5: Run focused and full Sites tests**

Run:

```bash
node --test --test-name-pattern='Google ID token|Google token|Google login bodies|verified Google email' tests/sites-worker.test.mjs
npm run test:sites
```

Expected: focused tests PASS and the full Sites suite remains green because the Google core is additive until Task 2 switches routing atomically.

- [ ] **Step 6: Commit the authentication core**

```bash
git add package.json package-lock.json worker/auth.js tests/sites-worker.test.mjs
git commit -m "feat: verify Google account sessions"
```

---

### Task 2: Route Google Login and Attribute Writes to the Verified Email

**Files:**
- Modify: `worker/index.js`
- Modify: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: `authenticateGoogle`, `readSession`, and `{ email }` identities from Task 1.
- Produces: public `GET /api/session/config`, public `POST /api/session/google`, protected existing APIs, and audit rows attributed to `qiaoen9816@gmail.com`.

- [ ] **Step 1: Write failing Worker route and audit tests**

Replace password test helpers with a signed Google credential helper and assert:

```js
test("publishes only the Google client ID needed by the login screen", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/session/config"),
    workerEnv(),
  );
  assert.deepEqual(await readJson(response), {
    googleClientId: TEST_GOOGLE_CLIENT_ID,
  });
});

test("creates a protected session only through Google and removes password routes", async () => {});
test("attributes enrolment, attendance, profile, stop, restore, and messages to the Google email", async () => {});
```

Change protected-read tests to authenticate through `POST /api/session/google`. Assert both `/api/session/password` and `/api/session/emergency` return 404.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern='publishes only|only through Google|attributes enrolment' tests/sites-worker.test.mjs
```

Expected: FAIL because the Worker still exposes `/api/session/password`, lacks `/api/session/config`, and uses `shared-access@local`.

- [ ] **Step 3: Implement routes and identity propagation**

Update public routing before the protected-session gate:

```js
if (pathname === "/api/session/config" && request.method === "GET") {
  if (!env.GOOGLE_CLIENT_ID) {
    return apiError(503, "AUTHENTICATION_UNAVAILABLE", "Authentication is unavailable");
  }
  return json({ googleClientId: env.GOOGLE_CLIENT_ID });
}
if (pathname === "/api/session/google" && request.method === "POST") {
  return authenticateGoogle(request, env);
}
```

Delete the password route and shared-operator import. Change the write handlers to accept the authenticated identity:

```js
async function enrolStudent(request, database, identity) {}
async function stopStudent(request, database, id, identity) {}
async function restoreStudent(request, database, id, identity) {}
async function updateProfile(request, database, id, identity) {}
async function updateAttendance(request, database, id, date, eventCode, identity) {}
async function createMessage(request, database, id, identity) {}
```

Bind `identity.email` directly into activity, attendance, profile-history, and message audit columns. Pass `identity` from `handleApi` to each mutating handler.

- [ ] **Step 4: Run all Sites tests**

Run:

```bash
npm run test:sites
```

Expected: all Sites tests PASS with Google-authenticated helpers and no password endpoint.

- [ ] **Step 5: Commit Worker routing**

```bash
git add worker/index.js tests/sites-worker.test.mjs
git commit -m "feat: require Google login for Sites APIs"
```

---

### Task 3: Render One Google Button in the Client

**Files:**
- Modify: `src/features/auth/LoginScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/api/client.js`
- Modify: `tests/client/branch-flow.test.jsx`
- Modify: `server/routes/session.js`
- Modify: `tests/server/session.test.js`

**Interfaces:**
- Consumes: `GET /api/session/config` and `POST /api/session/google` from Task 2.
- Produces: `sessionApi.googleConfig()`, `sessionApi.googleLogin(credential)`, and `LoginScreen({ googleClientId, onGoogleLogin })`.

- [ ] **Step 1: Write failing client tests for the exact login flow**

Replace the password-login test with:

```jsx
it("shows only Google login and opens branches after one credential callback", async () => {
  let credentialCallback;
  window.google = {
    accounts: {
      id: {
        initialize(options) { credentialCallback = options.callback; },
        renderButton(target, options) {
          expect(target).toHaveAttribute("aria-label", "Google 登录");
          expect(options).toMatchObject({
            type: "standard",
            size: "large",
            text: "signin_with",
            shape: "pill",
            locale: "zh_CN",
          });
        },
      },
    },
  };
  // GET /api/session -> 401
  // GET /api/session/config -> { googleClientId }
  // POST /api/session/google -> 204 with { credential }
  // GET /api/catalog -> existing catalog
});
```

Also add:

```jsx
it("shows a refresh message when the Google script cannot load", async () => {});
it("keeps a generic error after Google credential rejection", async () => {});
```

Assert `系统密码`, password inputs, `紧急密码`, and `紧急登录` are absent.

- [ ] **Step 2: Run the client test and verify RED**

Run:

```bash
npx vitest run tests/client/branch-flow.test.jsx
```

Expected: FAIL because the UI renders a password form and the API client lacks Google configuration/login methods.

- [ ] **Step 3: Implement the API and app state**

Replace password methods with:

```js
googleConfig: () => apiRequest("/api/session/config"),
googleLogin: (credential) => apiRequest("/api/session/google", {
  method: "POST",
  body: { credential },
}),
```

In `App`, add `googleClientId` state. When session restoration returns 401, load `googleConfig`, store `googleClientId`, and render:

```jsx
<LoginScreen
  googleClientId={googleClientId}
  onGoogleLogin={loginWithGoogle}
/>
```

The Google callback posts the credential then calls the existing `openEntrance()`.

- [ ] **Step 4: Implement Google Identity Services script lifecycle**

Load exactly `https://accounts.google.com/gsi/client?hl=zh_CN`, initialize once per mounted login screen, and render:

```js
window.google.accounts.id.initialize({
  client_id: googleClientId,
  callback: handleCredential,
});
window.google.accounts.id.renderButton(googleButton.current, {
  type: "standard",
  theme: "outline",
  size: "large",
  text: "signin_with",
  shape: "pill",
  logo_alignment: "left",
  width: 320,
  locale: "zh_CN",
});
```

Render only the heading, `使用 Google 账号登录后选择分院`, the Google button container, a pending status, and a generic error alert. Remove all password state and form markup.

- [ ] **Step 5: Add local/Render configuration parity**

In `server/routes/session.js`, add before the protected current-session route:

```js
router.get("/config", (_request, response) => response.json({
  googleClientId: config.googleClientId,
}));
```

Add a server test asserting the route is public and returns only the client ID. Keep the existing Google credential verifier and allowlist behavior so local development can use the same client.

- [ ] **Step 6: Run client and server tests**

Run:

```bash
npx vitest run tests/client/branch-flow.test.jsx tests/server/session.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 7: Commit the client flow**

```bash
git add src/features/auth/LoginScreen.jsx src/App.jsx src/api/client.js tests/client/branch-flow.test.jsx server/routes/session.js tests/server/session.test.js
git commit -m "feat: use one Google account login button"
```

---

### Task 4: Bundle a Self-Contained Sites Worker

**Files:**
- Create: `vite.worker.config.mjs`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `package.json`
- Modify: `tests/sites-worker.test.mjs`

**Interfaces:**
- Consumes: `worker/index.js` and its `jose` dependency.
- Produces: `dist/server/index.js` with no runtime bare-package imports.

- [ ] **Step 1: Write the failing package-artifact assertion**

Update the Sites packaging test to read the built Worker:

```js
const packagedWorker = await readFile(
  new URL("../dist/server/index.js", import.meta.url),
  "utf8",
);
assert.doesNotMatch(packagedWorker, /from\s+["']jose["']/u);
assert.match(packagedWorker, /api\/session\/google/u);
await assert.rejects(access(new URL("../dist/server/auth.js", import.meta.url)));
```

Replace the assertion that `dist/server/auth.js` exists with the rejection above because the auth module will be bundled into `index.js`.

- [ ] **Step 2: Run a clean build/package test and verify RED**

Run:

```bash
npm run build
npm run test:sites
```

Expected: FAIL because the current prepare script copies unbundled source and still emits `auth.js`.

- [ ] **Step 3: Add the Worker bundle configuration**

Create `vite.worker.config.mjs`:

```js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "worker/index.js",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist/server",
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    target: "es2022",
  },
});
```

Change the build script to:

```json
"build": "vite build && vite build --config vite.worker.config.mjs && node scripts/prepare-sites-build.mjs"
```

Change `prepare-sites-build.mjs` to verify `dist/server/index.js`, stop deleting `dist/server`, and stop copying `worker/`. Continue packaging hosting metadata, schema, and migrations.

- [ ] **Step 4: Run build and packaging tests**

Run:

```bash
npm run build
npm run test:sites
```

Expected: build exits 0; all Sites tests PASS; packaged Worker has no bare `jose` import.

- [ ] **Step 5: Commit the Worker bundle**

```bash
git add vite.worker.config.mjs scripts/prepare-sites-build.mjs package.json tests/sites-worker.test.mjs
git commit -m "build: bundle Google auth for Sites"
```

---

### Task 5: Full Regression Verification

**Files:**
- Modify only if a regression test exposes a defect.

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: a clean, deployable source tree and artifact.

- [ ] **Step 1: Run the full unit/integration suite**

Run outside a sandbox that blocks local test listeners:

```bash
npm test -- --maxWorkers=1
```

Expected: all 121-or-more tests PASS with zero failures.

- [ ] **Step 2: Run Sites and browser suites**

Run:

```bash
npm run build
npm run test:sites
npm run test:e2e
```

Expected: build, Sites tests, and desktop/mobile Playwright tests all PASS. Update the read-only smoke expectation from `系统密码` to the visible Google login container if needed through a prior RED-GREEN test cycle.

- [ ] **Step 3: Run source checks**

Run:

```bash
git diff --check
rg -n "系统密码|紧急密码|shared-access@local|api/session/password" src worker tests/e2e
git status --short
```

Expected: no whitespace errors; no production UI or Worker password route; only intentional historical/test references remain.

- [ ] **Step 4: Commit any verification-only test update**

If Task 5 required a smoke-test expectation change:

```bash
git add tests/e2e/smoke.spec.js
git commit -m "test: verify Google-only production entrance"
```

Otherwise, do not create an empty commit.

---

### Task 6: Configure Google and Deploy the Existing Site

**Files:**
- No source modifications expected.

**Interfaces:**
- Consumes: exact pushed commit and its `dist` archive, existing Sites project ID, existing Google OAuth client ID.
- Produces: the same live URL with Google-only authentication.

- [ ] **Step 1: Authorize the production JavaScript origin in Google Cloud**

Open the existing Web application OAuth client and add exactly:

```text
https://daycare-checkin-optimized.cyedu111.chatgpt.site
```

Do not add a path or trailing slash. Preserve the existing Render origin and redirect URI. If Google asks for password or two-factor authentication, pause only for that user-owned authentication step.

- [ ] **Step 2: Set production Sites environment values**

Set:

```text
GOOGLE_CLIENT_ID=632635821776-c0061mkerfjre56rivsfli72l7re1a28.apps.googleusercontent.com
GOOGLE_ALLOWED_EMAIL=qiaoen9816@gmail.com
ACCESS_SESSION_SECRET remains unchanged through a secret-preserving environment update
```

Remove `ACCESS_PASSWORD_SHA256` after the Google-only version is live. Never print secret values in logs or the final response.

- [ ] **Step 3: Push and package the exact verified commit**

Run:

```bash
git status --short
git rev-parse HEAD
npm run build
```

Expected: clean source tree before build and a successful artifact from the same commit. Push that exact commit to the existing Sites source repository and create a gzip tar archive from `dist/` without modifying the source afterward.

- [ ] **Step 4: Save and deploy a new Sites version**

Reuse project ID `appgprj_6a673e3afe2c819186da12047e199e5d`. Save a version referencing the pushed commit and exact archive, deploy that saved version, and wait for terminal deployment status `succeeded`.

- [ ] **Step 5: Verify production access before claiming completion**

Check in the user's browser:

1. Existing URL opens without a ChatGPT account gate.
2. No password field is present.
3. One Google button is present.
4. `qiaoen9816@gmail.com` logs in successfully.
5. MK, STP, and WS appear.
6. One teacher roster loads without exposing student names in diagnostic output.
7. Logout returns to Google login.
8. Another Google account is rejected with only the generic error.

Read recent production Worker errors and confirm no 500 responses during this flow.

- [ ] **Step 6: Preserve the deployment branch**

Keep branch `codex/daycare-optimized` and worktree `.worktrees/daycare-optimized` after deployment so the user's main checkout remains untouched.

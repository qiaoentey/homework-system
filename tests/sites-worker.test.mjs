import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { parseRosterCsv, ROSTER_FILES } from "../scripts/import-rosters.mjs";
import { JANICE_ROSTER } from "./fixtures/janiceRoster.js";
import { WS_HUILING_REQUESTED_ROSTER } from "./fixtures/wsHuilingRequestedRoster.js";
import * as workerAuth from "../worker/auth.js";
import worker from "../worker/index.js";
import { createSitesD1 } from "./helpers/sitesD1.mjs";

const noAssetFallback = {
  fetch: async () => new Response("missing", { status: 404 }),
};
const TEST_SESSION_SECRET = "test-session-secret-with-at-least-32-random-bytes";
const TEST_GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
const TEST_ALLOWED_EMAIL = "qiaoen9816@gmail.com";
const TEST_SECOND_ALLOWED_EMAIL = "raydenweng417@gmail.com";
const TEST_GOOGLE_NOW = Date.parse("2026-08-01T05:00:00.000Z");
const emptyProfile = {
  school: "",
  schoolClass: "",
  usualPickupTime: "",
  pickupMethod: "",
  vanDriver: "",
  vanHomeTime: "",
  vanMonday: "",
  vanTuesday: "",
  vanWednesday: "",
  vanThursday: "",
  vanFriday: "",
  dinnerRequired: "",
  dinnerMonday: "",
  dinnerTuesday: "",
  dinnerWednesday: "",
  dinnerThursday: "",
  dinnerFriday: "",
  lateStayMonday: "",
  lateStayTuesday: "",
  lateStayWednesday: "",
  lateStayThursday: "",
  lateStayFriday: "",
  careProgram: "",
  homeworkArrivalTime: "",
  homeworkDepartureTime: "",
  homeworkMonday: "",
  homeworkTuesday: "",
  homeworkWednesday: "",
  homeworkThursday: "",
  homeworkFriday: "",
  showerRequired: "",
  detentionType: "",
  specialNoteHighC: "",
  specialNoteDailyHomeworkPhoto: "",
  specialNoteNotifyIncompleteHomework: "",
  specialNoteOther: "",
};
const enrolmentConflictCases = [
  ["name", { name: "ANOTHER STUDENT" }, groupHeaders()],
  ["grade", { grade: "Y4" }, groupHeaders()],
  ["group", { groupCode: "MK QIAO EN" }, groupHeaders("MK", "MK QIAO EN")],
  [
    "branch and group",
    { branchCode: "WS", groupCode: "WS HUILING" },
    groupHeaders("WS", "WS HUILING"),
  ],
  ...Object.keys(emptyProfile).map((field) => [
    `profile.${field}`,
    { profile: { ...emptyProfile, [field]: `changed ${field}` } },
    groupHeaders(),
  ]),
];
const approvedCounts = {
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "巧恩 STP": 90,
  "PS STP": 83,
  "SY STP": 50,
  "YUAN NING STP": 43,
  "JANICE STP": 52,
  "WS HUILING": 89,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
};
const yuanNingGrades = {
  "邓威乐": "Y1",
  "刘柏亨": "Y1",
  "曾于哲": "Y1",
  "张皓翔": "Y1",
  "黄靖芯": "Y1",
  "叶思羽": "Y1",
  Macy: "Y1",
  "陈祈文": "Y1",
  "陈凯泽": "Y1",
  "Eason Chan": "Y1",
  "邓茹予": "Y1",
  "杨景立": "Y1",
  Julian: "Y1",
  "和凯乐": "Y1",
  Jayden: "Y1",
  "刘思源": "Y1",
  "刘恩甯": "Y1",
  Afzan: "Y1",
  Ava: "Y1",
  "陈美芯": "Y1",
  "陈嘉谦": "Y1",
  "范旻宏": "Y1",
  "蔡颜馡": "Y1",
  "伍悦帧": "Y1",
  "马佳瑜": "Y1",
  "陈凯": "Y1",
  "林宥承": "Y1",
  "林佑峻": "Y1",
  "刘俊盛": "Y1",
  "陈杰": "Y5",
  "陈彦州": "Y5",
  Owen: "Y5",
  "陈佳莹": "Y5",
  "萧欣甯": "K1+K2",
  "萧皓恒": "K1+K2",
  "陈羽捷": "K1+K2",
  "丁文淇": "K1+K2",
  "卢奕衡": "K1+K2",
  "陈梓煒": "K1+K2",
  "李媛霏": "K1+K2",
  "Abby Lee": "K1+K2",
  "蔡卓亨": "K1+K2",
  "叶泋妤": "K1+K2",
};
const transferredPsSourceRefs = [
  "stp-ps-001", "stp-ps-003", "stp-ps-004", "stp-ps-005",
  "stp-ps-006", "stp-ps-007", "stp-ps-008", "stp-ps-010",
  "stp-ps-011", "stp-ps-012", "stp-ps-013", "stp-ps-014",
  "stp-ps-016", "stp-ps-017", "stp-ps-018", "stp-ps-020",
  "stp-ps-021", "stp-ps-022", "stp-ps-023", "stp-ps-026",
  "stp-ps-027", "stp-ps-028", "stp-ps-030", "stp-ps-031",
  "stp-ps-032", "stp-ps-033", "stp-ps-035", "stp-ps-036",
  "stp-ps-038", "stp-ps-039", "stp-ps-040", "stp-ps-042",
  "stp-ps-043", "stp-ps-044", "stp-ps-045", "stp-ps-115",
  "stp-ps-117", "stp-ps-119",
];

async function api(path, options = {}) {
  return worker.fetch(new Request(`https://example.test${path}`, options), {
    ASSETS: noAssetFallback,
  });
}

function workerEnv(env = {}) {
  return {
    ASSETS: noAssetFallback,
    ACCESS_SESSION_SECRET: TEST_SESSION_SECRET,
    GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID,
    GOOGLE_ALLOWED_EMAIL: TEST_ALLOWED_EMAIL,
    ...env,
  };
}

const testGoogleFixture = googleFixture();

async function googleFixture() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-google-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const jwks = createLocalJWKSet({ keys: [publicJwk] });

  async function sign({
    email = TEST_ALLOWED_EMAIL,
    emailVerified = true,
    audience = TEST_GOOGLE_CLIENT_ID,
    issuer = "https://accounts.google.com",
    issuedAt = Math.floor(TEST_GOOGLE_NOW / 1000),
    expiresAt = Math.floor(TEST_GOOGLE_NOW / 1000) + 300,
    signingKey = privateKey,
  } = {}) {
    return new SignJWT({ email, email_verified: emailVerified })
      .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
      .setSubject("google-user-123")
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(signingKey);
  }

  return { jwks, sign };
}

async function googleLoginRequest(credential, env = {}, now = TEST_GOOGLE_NOW) {
  return workerAuth.authenticateGoogle(
    new Request("https://example.test/api/session/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential }),
    }),
    workerEnv(env),
    { jwks: env.jwks, now },
  );
}

const loginCookieByDatabase = new WeakMap();

async function loginCookie(DB) {
  if (!loginCookieByDatabase.has(DB)) {
    loginCookieByDatabase.set(DB, testGoogleFixture.then(async ({ jwks, sign }) => {
      const now = Date.now();
      const issuedAt = Math.floor(now / 1000);
      const response = await googleLoginRequest(await sign({
        issuedAt,
        expiresAt: issuedAt + 300,
      }), { jwks }, now);
      assert.equal(response.status, 204);
      return response.headers.get("set-cookie").split(";", 1)[0];
    }));
  }
  return loginCookieByDatabase.get(DB);
}

async function apiWithD1(env, path, {
  method = "GET",
  body,
  headers = {},
  authenticated = true,
} = {}) {
  const cookie = authenticated ? await loginCookie(env.DB) : null;
  return worker.fetch(new Request(`https://example.test${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...headers,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), workerEnv({ DB: env.DB }));
}

function groupHeaders(branchCode = "MK", groupCode = "MK HAPPY") {
  return {
    "X-Branch-Code": branchCode,
    "X-Group-Code": groupCode,
  };
}

async function readJson(response, status = 200) {
  assert.equal(response.status, status);
  return response.json();
}

async function withD1(operation) {
  const env = await createSitesD1();
  try {
    await operation(env);
  } finally {
    env.close();
  }
}

test("accepts a signed Google ID token for the only allowed verified email", async () => {
  assert.equal(typeof workerAuth.verifyGoogleCredential, "function");
  const { jwks, sign } = await googleFixture();
  const identity = await workerAuth.verifyGoogleCredential(await sign(), {
    clientId: TEST_GOOGLE_CLIENT_ID,
    jwks,
    now: TEST_GOOGLE_NOW,
  });

  assert.deepEqual(identity, {
    email: TEST_ALLOWED_EMAIL,
    sub: "google-user-123",
  });
});

test("accepts every normalized email in the comma-separated Google allowlist", async () => {
  const { jwks, sign } = await googleFixture();
  const env = {
    GOOGLE_ALLOWED_EMAIL: undefined,
    GOOGLE_ALLOWED_EMAILS: ` ${TEST_ALLOWED_EMAIL.toUpperCase()}, ${TEST_SECOND_ALLOWED_EMAIL} `,
    jwks,
  };

  for (const email of [TEST_ALLOWED_EMAIL, TEST_SECOND_ALLOWED_EMAIL]) {
    const login = await googleLoginRequest(await sign({ email }), env);
    assert.equal(login.status, 204, email);

    const request = new Request("https://example.test/api/session", {
      headers: { cookie: login.headers.get("set-cookie").split(";", 1)[0] },
    });
    assert.deepEqual(
      await workerAuth.readSession(request, workerEnv(env), TEST_GOOGLE_NOW + 1_000),
      { email },
    );
  }
});

test("rejects a valid Google token for another email with a generic response", async () => {
  assert.equal(typeof workerAuth.authenticateGoogle, "function");
  const { jwks, sign } = await googleFixture();
  const disallowed = await googleLoginRequest(
    await sign({ email: "another-teacher@example.com" }),
    { jwks },
  );
  const invalid = await googleLoginRequest("not-a-google-token", { jwks });

  assert.equal(disallowed.status, 401);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await disallowed.json(), await invalid.json());
  assert.equal(disallowed.headers.get("set-cookie"), null);
});

test("rejects unverified email, wrong audience, wrong issuer, expiry, and bad signature", async () => {
  assert.equal(typeof workerAuth.verifyGoogleCredential, "function");
  const { jwks, sign } = await googleFixture();
  const { privateKey: otherKey } = await generateKeyPair("RS256");
  const invalidTokens = [
    await sign({ emailVerified: false }),
    await sign({ audience: "other-client.apps.googleusercontent.com" }),
    await sign({ issuer: "https://issuer.example" }),
    await sign({ expiresAt: Math.floor(TEST_GOOGLE_NOW / 1000) - 1 }),
    await sign({ signingKey: otherKey }),
  ];

  for (const credential of invalidTokens) {
    await assert.rejects(workerAuth.verifyGoogleCredential(credential, {
      clientId: TEST_GOOGLE_CLIENT_ID,
      jwks,
      now: TEST_GOOGLE_NOW,
    }));
  }
});

test("rejects malformed Google login bodies and missing auth configuration", async () => {
  assert.equal(typeof workerAuth.authenticateGoogle, "function");
  const malformed = await workerAuth.authenticateGoogle(
    new Request("https://example.test/api/session/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "token", extra: true }),
    }),
    workerEnv(),
    { now: TEST_GOOGLE_NOW },
  );
  const unavailable = await workerAuth.authenticateGoogle(
    new Request("https://example.test/api/session/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "token" }),
    }),
    { ASSETS: noAssetFallback },
    { now: TEST_GOOGLE_NOW },
  );

  assert.equal(malformed.status, 400);
  assert.equal(unavailable.status, 503);
});

test("reads the verified Google email from a signed 12-hour session", async () => {
  assert.equal(typeof workerAuth.authenticateGoogle, "function");
  const { jwks, sign } = await googleFixture();
  const login = await googleLoginRequest(await sign(), { jwks });
  assert.equal(login.status, 204);
  const cookie = login.headers.get("set-cookie");
  assert.match(cookie, /__Host-daycare_session=/u);
  assert.match(cookie, /Max-Age=43200/u);

  const request = new Request("https://example.test/api/session", {
    headers: { cookie: cookie.split(";", 1)[0] },
  });
  assert.deepEqual(
    await workerAuth.readSession(request, workerEnv(), TEST_GOOGLE_NOW + 1_000),
    { email: TEST_ALLOWED_EMAIL },
  );
  assert.equal(
    await workerAuth.readSession(
      request,
      workerEnv(),
      TEST_GOOGLE_NOW + (12 * 60 * 60 * 1000) + 1_000,
    ),
    null,
  );
});

test("publishes only the public Google client ID before login", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/session/config"),
    workerEnv(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    googleClientId: TEST_GOOGLE_CLIENT_ID,
  });
});

test("creates sessions only through Google and hides obsolete login routes", async () => {
  const malformedGoogle = await worker.fetch(
    new Request("https://example.test/api/session/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    workerEnv(),
  );
  assert.equal(malformedGoogle.status, 400);

  for (const path of ["/api/session/password", "/api/session/emergency"]) {
    const response = await worker.fetch(
      new Request(`https://example.test${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      workerEnv(),
    );
    assert.equal(response.status, 404, path);
  }
});

test("rejects protected reads and writes without a Google session", async () => {
  await withD1(async (env) => {
    for (const [path, method] of [
      ["/api/session", "GET"],
      ["/api/catalog", "GET"],
      ["/api/students?branch=MK&group=MK%20HAPPY&status=active", "GET"],
      ["/api/students", "POST"],
    ]) {
      const response = await apiWithD1(env, path, {
        method,
        authenticated: false,
      });
      assert.equal(response.status, 401, `${method} ${path}`);
    }
  });
});

test("serves the verified Google session and fixed branch catalog after login", async () => {
  await withD1(async (env) => {
    const session = await apiWithD1(env, "/api/session");
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { email: TEST_ALLOWED_EMAIL });

    const catalog = await apiWithD1(env, "/api/catalog");
    assert.equal(catalog.status, 200);
    assert.deepEqual(await catalog.json(), {
      branches: [
        {
          code: "MK",
          label: "MK",
          groups: [
            { code: "MK HAPPY", label: "HAPPY" },
            { code: "MK QIAO EN", label: "QIAO EN" },
            { code: "MK WEN XUAN", label: "WEN XUAN" },
          ],
        },
        {
          code: "STP",
          label: "STP",
          groups: [
            { code: "巧恩 STP", label: "巧恩" },
            { code: "PS STP", label: "PS" },
            { code: "SY STP", label: "SY" },
            { code: "YUAN NING STP", label: "YUAN NING" },
            { code: "JANICE STP", label: "JANICE" },
          ],
        },
        {
          code: "WS",
          label: "WS",
          groups: [
            { code: "WS HUILING", label: "HUILING" },
            { code: "WS JIA WEN", label: "JIA WEN" },
            { code: "WS MIXIN", label: "MIXIN" },
          ],
        },
      ],
    });
  });
});

test("rejects a tampered Google-session cookie", async () => {
  await withD1(async (env) => {
    const cookie = await loginCookie(env.DB);
    const signatureStart = cookie.indexOf(".") + 1;
    const replacement = cookie[signatureStart] === "a" ? "b" : "a";
    const tampered = `${cookie.slice(0, signatureStart)}${replacement}${cookie.slice(signatureStart + 1)}`;
    const response = await apiWithD1(env, "/api/catalog", {
      authenticated: false,
      headers: { cookie: tampered },
    });
    assert.equal(response.status, 401);
  });
});

test("rejects an expired Google-session cookie", async () => {
  await withD1(async (env) => {
    const cookie = await loginCookie(env.DB);
    const identity = await workerAuth.readSession(
      new Request("https://example.test/api/session", {
        headers: { cookie },
      }),
      workerEnv({ DB: env.DB }),
      Date.now() + (12 * 60 * 60 * 1000) + 1_000,
    );
    assert.equal(identity, null);
  });
});

test("logout clears the Google session cookie", async () => {
  await withD1(async (env) => {
    const response = await apiWithD1(env, "/api/session", { method: "DELETE" });
    assert.equal(response.status, 204);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/u);
    assert.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/u);
  });
});

test("reports Worker API health without consulting static assets", async () => {
  const response = await api("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("executes every breakpoint migration chunk within D1's 100000-byte limit", async () => {
  await withD1(async () => {});
});

test("applies the breakpoint-delimited Sites migration idempotently with exact active roster counts", async () => {
  await withD1(async (env) => {
    await env.execMigration();

    let total = 0;
    for (const [groupCode, expected] of Object.entries(approvedCounts)) {
      const branchCode = groupCode.includes("STP")
        ? "STP"
        : groupCode.startsWith("WS ")
          ? "WS"
          : "MK";
      const response = await readJson(await apiWithD1(
        env,
        `/api/students?branch=${branchCode}&group=${encodeURIComponent(groupCode)}&status=active&limit=50`,
      ));
      assert.equal(response.total, expected, groupCode);
      assert.ok(response.items.every((student) => (
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u.test(student.id)
      )));
      total += response.total;
    }
    assert.equal(total, 650);

    const branchByGroup = Object.fromEntries(
      Object.keys(approvedCounts).map((groupCode) => [
        groupCode,
        groupCode.includes("STP")
          ? "STP"
          : groupCode.startsWith("WS ")
            ? "WS"
            : "MK",
      ]),
    );
    const expectedRoster = [];
    for (const file of ROSTER_FILES) {
      const records = parseRosterCsv(await readFile(file.filePath, "utf8"), file.groupCode);
      expectedRoster.push(...records.map((record) => ({
        source_ref: record.sourceRef,
        name: record.name,
        grade: record.grade,
        branch_code: branchByGroup[file.groupCode],
        group_code: file.groupCode,
      })));
    }
    expectedRoster.sort((left, right) => left.source_ref.localeCompare(right.source_ref));
    const migratedRoster = await env.DB.prepare(
      `SELECT source_ref, name, grade, branch_code, group_code
       FROM students
       ORDER BY source_ref`,
    ).all();
    assert.deepEqual(migratedRoster.results.map((row) => ({ ...row })), expectedRoster);

    const yuanNing = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=YUAN%20NING%20STP&status=active&limit=50",
    ));
    assert.equal(yuanNing.total, 43);
    assert.deepEqual(
      Object.fromEntries(yuanNing.items.map(({ name, grade }) => [name, grade])),
      yuanNingGrades,
    );

    const janice = await env.DB.prepare(
      `SELECT name, grade
       FROM students
       WHERE group_code = 'JANICE STP'
       ORDER BY source_ref`,
    ).all();
    assert.deepEqual(
      janice.results.map(({ name, grade }) => [name, grade]),
      JANICE_ROSTER,
    );

    const wsHuiling = await env.DB.prepare(
      `SELECT name, grade
       FROM students
       WHERE group_code = 'WS HUILING' AND status = 'active'
       ORDER BY source_ref`,
    ).all();
    assert.equal(wsHuiling.results.length, 89);
    const wsHuilingIdentities = new Set(
      wsHuiling.results.map(({ name, grade }) => `${name}\u0000${grade}`),
    );
    for (const [name, grade] of WS_HUILING_REQUESTED_ROSTER) {
      assert.ok(wsHuilingIdentities.has(`${name}\u0000${grade}`), `${name} ${grade}`);
    }
    assert.equal(wsHuilingIdentities.has("chen yi qi\u0000Y1"), false);
    assert.equal(wsHuilingIdentities.has("胡浩文\u0000Y3"), false);

    const transferred = await env.DB.prepare(
      `SELECT id, source_ref, group_code
       FROM students
       WHERE source_ref IN (${transferredPsSourceRefs.map(() => "?").join(", ")})
       ORDER BY source_ref`,
    ).bind(...transferredPsSourceRefs).all();
    assert.equal(transferred.results.length, 38);
    assert.ok(transferred.results.every((row) => (
      row.id.startsWith("dc05") && row.group_code === "YUAN NING STP"
    )));

    const qiaoEn = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20QIAO%20EN&status=active&search=Aria",
    ));
    assert.deepEqual(qiaoEn.items.map(({ name, grade }) => ({ name, grade })), [
      { name: "Aria", grade: "Y6" },
    ]);
  });
});

test("validates every branch/group read and write boundary", async () => {
  await withD1(async (env) => {
    const readMismatch = await readJson(await apiWithD1(
      env,
      "/api/students?branch=WS&group=MK%20HAPPY&status=active",
    ), 400);
    assert.equal(readMismatch.code, "GROUP_BRANCH_MISMATCH");

    const missingContext = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      body: {
        name: "NO CONTEXT",
        grade: "Y3",
        branchCode: "MK",
        groupCode: "MK HAPPY",
        profile: emptyProfile,
      },
    }), 400);
    assert.equal(missingContext.code, "WRITE_CONTEXT_REQUIRED");

    const mismatchContext = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders("WS", "MK HAPPY"),
      body: {
        name: "BAD GROUP",
        grade: "Y3",
        branchCode: "WS",
        groupCode: "MK HAPPY",
        profile: emptyProfile,
      },
    }), 400);
    assert.equal(mismatchContext.code, "GROUP_BRANCH_MISMATCH");
  });
});

test("searches and paginates the 83-student PS roster with stable cursors", async () => {
  await withD1(async (env) => {
    const first = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=PS%20STP&status=active&limit=500",
    ));
    assert.equal(first.items.length, 50);
    assert.equal(first.total, 83);
    assert.equal(typeof first.nextCursor, "string");

    const second = await readJson(await apiWithD1(
      env,
      `/api/students?branch=STP&group=PS%20STP&status=active&limit=50&cursor=${encodeURIComponent(first.nextCursor)}`,
    ));
    assert.equal(second.items.length, 33);
    assert.equal(new Set([...first.items, ...second.items].map(({ id }) => id)).size, 83);

    const search = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=PS%20STP&status=active&search=weijun",
    ));
    assert.equal(search.total, 1);
    assert.equal(search.items[0].name, "徐weijun");

    const invalid = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=PS%20STP&status=active&cursor=broken",
    ), 400);
    assert.equal(invalid.code, "INVALID_CURSOR");
  });
});

test("writes, lists, summarizes, and clears attendance", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20HAPPY&status=active&limit=1",
    ));
    const student = roster.items[0];
    const prefix = `/api/students/${student.id}/attendance/2026-07-27`;

    for (const eventCode of ["arrive", "shower"]) {
      const event = await readJson(await apiWithD1(env, `${prefix}/${eventCode}`, {
        method: "PUT",
        headers: groupHeaders(),
        body: { active: true },
      }));
      assert.equal(event.studentId, student.id);
      assert.equal(event.eventCode, eventCode);
      assert.equal(event.active, true);
      assert.equal(event.updatedBy, TEST_ALLOWED_EMAIL);
    }

    for (const eventCode of ["home", "review", "koko"]) {
      const removedEvent = await readJson(await apiWithD1(env, `${prefix}/${eventCode}`, {
        method: "PUT",
        headers: groupHeaders(),
        body: { active: true },
      }), 400);
      assert.equal(removedEvent.code, "INVALID_ATTENDANCE_EVENT");
    }

    const attendance = await readJson(await apiWithD1(
      env,
      "/api/attendance?branch=MK&group=MK%20HAPPY&date=2026-07-27",
    ));
    assert.deepEqual(attendance.items.filter(({ active }) => active).map(({ eventCode }) => eventCode), ["arrive", "shower"]);

    const summary = await readJson(await apiWithD1(
      env,
      "/api/summary?branch=MK&group=MK%20HAPPY&date=2026-07-27",
    ));
    assert.deepEqual(summary, {
      expected: 82,
      arrived: 1,
      notArrived: 81,
      absent: 0,
      unmarked: 81,
    });

    assert.deepEqual(await readJson(await apiWithD1(env, prefix, {
      method: "DELETE",
      headers: groupHeaders(),
    })), { cleared: 2 });
  });
});

test("returns a signed-in daily dashboard for every daycare group", async () => {
  await withD1(async (env) => {
    assert.equal((await apiWithD1(env, "/api/dashboard?date=2026-07-27", {
      authenticated: false,
    })).status, 401);
    assert.equal((await apiWithD1(env, "/api/dashboard?date=2026-02-30")).status, 400);
    assert.equal((await apiWithD1(env, "/api/dashboard?date=2026-07-27&branch=MK")).status, 400);

    await env.DB.prepare(
      "DELETE FROM students WHERE group_code IN (?, ?, ?)",
    ).bind("MK HAPPY", "MK WEN XUAN", "WS HUILING").run();
    const students = [
      ["10000000-0000-4000-8000-000000000201", "MK ARRIVED", "MK", "MK HAPPY"],
      ["10000000-0000-4000-8000-000000000202", "MK ABSENT", "MK", "MK HAPPY"],
      ["10000000-0000-4000-8000-000000000203", "MK KOKO", "MK", "MK HAPPY"],
      ["10000000-0000-4000-8000-000000000204", "MK UNMARKED", "MK", "MK HAPPY"],
      ["10000000-0000-4000-8000-000000000205", "WS KOKO", "WS", "WS HUILING"],
    ];
    await env.DB.batch(students.map(([id, name, branchCode, groupCode]) => env.DB.prepare(
      `INSERT INTO students (id, name, grade, branch_code, group_code, status, source_ref)
       VALUES (?, ?, 'Y4', ?, ?, 'active', ?)`,
    ).bind(id, name, branchCode, groupCode, `dashboard-${id}`)));
    const events = [
      [students[0][0], "arrive"],
      [students[0][0], "shower"],
      [students[0][0], "meal"],
      [students[0][0], "homework"],
      [students[0][0], "supplement"],
      [students[1][0], "absent"],
      [students[2][0], "koko"],
      [students[4][0], "koko"],
    ];
    await env.DB.batch(events.map(([studentId, eventCode]) => env.DB.prepare(
      `INSERT INTO attendance_events
         (student_id, attendance_date, event_code, is_active, updated_by)
       VALUES (?, '2026-07-27', ?, 1, 'fixture@example.com')`,
    ).bind(studentId, eventCode)));

    const dashboard = await readJson(await apiWithD1(
      env,
      "/api/dashboard?date=2026-07-27",
    ));
    assert.equal(dashboard.date, "2026-07-27");
    assert.equal(dashboard.groups.length, 11);
    const mkHappy = dashboard.groups.find(({ groupCode }) => groupCode === "MK HAPPY");
    assert.deepEqual(mkHappy, {
      branchCode: "MK",
      groupCode: "MK HAPPY",
      groupLabel: "HAPPY",
      summary: {
        expected: 4,
        arrived: 1,
        notArrived: 2,
        absent: 1,
        unmarked: 2,
      },
      students: [
        {
          id: students[1][0],
          name: "MK ABSENT",
          grade: "Y4",
          status: "absent",
          events: ["absent"],
        },
        {
          id: students[0][0],
          name: "MK ARRIVED",
          grade: "Y4",
          status: "arrived",
          events: ["arrive", "shower", "meal", "homework", "supplement"],
        },
        { id: students[2][0], name: "MK KOKO", grade: "Y4", status: "unmarked", events: [] },
        { id: students[3][0], name: "MK UNMARKED", grade: "Y4", status: "unmarked", events: [] },
      ],
    });
    const currentClass = await readJson(await apiWithD1(
      env,
      "/api/summary?branch=MK&group=MK%20HAPPY&date=2026-07-27",
    ));
    assert.deepEqual(currentClass, mkHappy.summary);
    assert.deepEqual(
      dashboard.groups.find(({ groupCode }) => groupCode === "MK WEN XUAN").summary,
      { expected: 0, arrived: 0, notArrived: 0, absent: 0, unmarked: 0 },
    );
  });
});

test("lists scoped attendance records including stopped history and conflicts", async () => {
  await withD1(async (env) => {
    await env.DB.prepare("DELETE FROM students WHERE group_code = ?").bind("MK HAPPY").run();
    const students = [
      ["10000000-0000-4000-8000-000000000101", "PRESENT", "active"],
      ["10000000-0000-4000-8000-000000000102", "STOPPED PRESENT", "stopped"],
      ["10000000-0000-4000-8000-000000000103", "ABSENT", "active"],
      ["10000000-0000-4000-8000-000000000104", "UNMARKED", "active"],
      ["10000000-0000-4000-8000-000000000105", "CONFLICT", "active"],
    ];
    await env.DB.batch(students.map(([id, name, status]) => env.DB.prepare(
      `INSERT INTO students (id, name, grade, branch_code, group_code, status, source_ref)
       VALUES (?, ?, 'Y4', 'MK', 'MK HAPPY', ?, ?)`,
    ).bind(id, name, status, `record-${id}`)));
    const events = [
      [students[0][0], "arrive", 1],
      [students[1][0], "arrive", 1],
      [students[2][0], "absent", 1],
      [students[3][0], "arrive", 0],
      [students[4][0], "arrive", 1],
      [students[4][0], "absent", 1],
    ];
    await env.DB.batch(events.map(([studentId, eventCode, active]) => env.DB.prepare(
      `INSERT INTO attendance_events
         (student_id, attendance_date, event_code, is_active, updated_by)
       VALUES (?, '2026-07-27', ?, ?, 'fixture@example.com')`,
    ).bind(studentId, eventCode, active)));

    const record = await readJson(await apiWithD1(
      env,
      "/api/attendance-records?branch=MK&group=MK%20HAPPY&date=2026-07-27",
    ));
    assert.deepEqual(record, {
      date: "2026-07-27",
      counts: { present: 2, absent: 1, unmarked: 1, conflicts: 1 },
      present: [
        { id: students[0][0], name: "PRESENT", grade: "Y4" },
        { id: students[1][0], name: "STOPPED PRESENT", grade: "Y4" },
      ],
      absent: [{ id: students[2][0], name: "ABSENT", grade: "Y4" }],
      unmarked: [{ id: students[3][0], name: "UNMARKED", grade: "Y4" }],
      conflicts: [{ id: students[4][0], name: "CONFLICT", grade: "Y4" }],
    });

    assert.equal((await apiWithD1(
      env,
      "/api/attendance-records?branch=MK&group=MK%20HAPPY&date=2026-02-30",
    )).status, 400);
    const mismatch = await readJson(await apiWithD1(
      env,
      "/api/attendance-records?branch=MK&group=WS%20HUILING&date=2026-07-27",
    ), 400);
    assert.equal(mismatch.code, "GROUP_BRANCH_MISMATCH");
  });
});

test("makes Worker arrive and absent writes mutually exclusive", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20HAPPY&status=active&limit=1",
    ));
    const student = roster.items[0];
    const prefix = `/api/students/${student.id}/attendance/2026-07-27`;
    await env.DB.prepare(
      `INSERT INTO attendance_events
         (student_id, attendance_date, event_code, is_active, updated_by)
       VALUES (?, '2026-07-27', 'absent', 1, 'fixture@example.com')`,
    ).bind(student.id).run();

    await readJson(await apiWithD1(env, `${prefix}/arrive`, {
      method: "PUT",
      headers: groupHeaders(),
      body: { active: true },
    }));
    let stored = await env.DB.prepare(
      `SELECT event_code, is_active FROM attendance_events
       WHERE student_id = ? AND attendance_date = '2026-07-27'
       ORDER BY event_code`,
    ).bind(student.id).all();
    assert.deepEqual(stored.results.map((row) => ({ ...row })), [
      { event_code: "absent", is_active: 0 },
      { event_code: "arrive", is_active: 1 },
    ]);

    await readJson(await apiWithD1(env, `${prefix}/absent`, {
      method: "PUT",
      headers: groupHeaders(),
      body: { active: true },
    }));
    await readJson(await apiWithD1(env, `${prefix}/arrive`, {
      method: "PUT",
      headers: groupHeaders(),
      body: { active: false },
    }));
    stored = await env.DB.prepare(
      `SELECT event_code, is_active FROM attendance_events
       WHERE student_id = ? AND attendance_date = '2026-07-27'
       ORDER BY event_code`,
    ).bind(student.id).all();
    assert.deepEqual(stored.results.map((row) => ({ ...row })), [
      { event_code: "absent", is_active: 1 },
      { event_code: "arrive", is_active: 0 },
    ]);
  });
});

test("decodes a browser-safe Chinese group header for Qiao En STP writes", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=%E5%B7%A7%E6%81%A9%20STP&status=active&limit=1",
    ));
    const student = roster.items[0];
    const event = await readJson(await apiWithD1(
      env,
      `/api/students/${student.id}/attendance/2026-08-01/arrive`,
      {
        method: "PUT",
        headers: {
          "X-Branch-Code": "STP",
          "X-Group-Code": encodeURIComponent("巧恩 STP"),
        },
        body: { active: true },
      },
    ));

    assert.equal(event.studentId, student.id);
    assert.equal(event.updatedBy, TEST_ALLOWED_EMAIL);
  });
});

test("atomically rejects one of two concurrent profile updates with the same version", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20QIAO%20EN&status=active&search=Aria",
    ));
    const student = roster.items[0];
    const seeded = await readJson(await apiWithD1(
      env,
      `/api/students/${student.id}/profile`,
      {
        method: "PATCH",
        headers: groupHeaders("MK", "MK QIAO EN"),
        body: {
          updatedAt: student.updatedAt,
          profile: {
            pickupMethod: "Bus",
            vanMonday: "需要",
            vanWednesday: "需要",
            vanFriday: "需要",
            dinnerRequired: "需要",
            dinnerMonday: "需要",
            dinnerTuesday: "不需要",
            showerRequired: "需要",
            detentionType: "功课留堂",
            specialNoteHighC: "需要",
            specialNoteDailyHomeworkPhoto: "需要",
            specialNoteNotifyIncompleteHomework: "需要",
            specialNoteOther: "放学前提醒带水壶",
            careProgram: "功课班",
            homeworkArrivalTime: "14:00",
            homeworkDepartureTime: "18:00",
            homeworkMonday: "有来",
            homeworkWednesday: "有来",
            homeworkFriday: "有来",
          },
        },
      },
    ));
    assert.equal(seeded.profile.pickupMethod, "Bus");
    assert.equal(seeded.profile.vanMonday, "需要");
    assert.equal(seeded.profile.vanTuesday, undefined);
    assert.equal(seeded.profile.vanWednesday, "需要");
    assert.equal(seeded.profile.vanThursday, undefined);
    assert.equal(seeded.profile.vanFriday, "需要");
    assert.equal(seeded.profile.dinnerRequired, "需要");
    assert.equal(seeded.profile.dinnerMonday, "需要");
    assert.equal(seeded.profile.dinnerTuesday, "不需要");
    assert.equal(seeded.profile.showerRequired, "需要");
    assert.equal(seeded.profile.detentionType, "功课留堂");
    assert.equal(seeded.profile.specialNoteHighC, "需要");
    assert.equal(seeded.profile.specialNoteDailyHomeworkPhoto, "需要");
    assert.equal(seeded.profile.specialNoteNotifyIncompleteHomework, "需要");
    assert.equal(seeded.profile.specialNoteOther, "放学前提醒带水壶");
    assert.equal(seeded.profile.careProgram, "功课班");
    assert.equal(seeded.profile.homeworkArrivalTime, "14:00");
    assert.equal(seeded.profile.homeworkDepartureTime, "18:00");
    assert.equal(seeded.profile.homeworkMonday, "有来");
    assert.equal(seeded.profile.homeworkTuesday, undefined);
    assert.equal(seeded.profile.homeworkWednesday, "有来");
    assert.equal(seeded.profile.homeworkThursday, undefined);
    assert.equal(seeded.profile.homeworkFriday, "有来");

    const settled = await Promise.allSettled([
      apiWithD1(env, `/api/students/${student.id}/profile`, {
        method: "PATCH",
        headers: groupHeaders("MK", "MK QIAO EN"),
        body: {
          updatedAt: seeded.updatedAt,
          profile: { school: "SJK Test" },
        },
      }),
      apiWithD1(env, `/api/students/${student.id}/profile`, {
        method: "PATCH",
        headers: groupHeaders("MK", "MK QIAO EN"),
        body: {
          updatedAt: seeded.updatedAt,
          profile: { schoolClass: "4A" },
        },
      }),
    ]);
    assert.deepEqual(settled.map(({ status }) => status), ["fulfilled", "fulfilled"]);
    const responses = settled.map(({ value }) => value);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);

    const success = await responses.find(({ status }) => status === 200).json();
    const conflict = await responses.find(({ status }) => status === 409).json();
    assert.equal(conflict.code, "STUDENT_CHANGED");
    assert.equal(success.profile.pickupMethod, "Bus");
    assert.equal(
      Number(Boolean(success.profile.school)) + Number(Boolean(success.profile.schoolClass)),
      1,
    );
    assert.notEqual(success.updatedAt, seeded.updatedAt);

    const stored = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20QIAO%20EN&status=active&search=Aria",
    ));
    assert.deepEqual(stored.items[0].profile, success.profile);
    assert.equal(stored.items[0].updatedAt, success.updatedAt);

    const activity = await env.DB.prepare(
      `SELECT action, actor
       FROM student_activity
       WHERE student_id = ?
       ORDER BY rowid`,
    ).bind(student.id).all();
    assert.deepEqual(activity.results.map((row) => ({ ...row })), [
      { action: "profile_update", actor: TEST_ALLOWED_EMAIL },
      { action: "profile_update", actor: TEST_ALLOWED_EMAIL },
    ]);
  });
});

test("creates and lists trimmed student messages newest first", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=WS&group=WS%20HUILING&status=active&limit=1",
    ));
    const student = roster.items[0];
    const path = `/api/students/${student.id}/messages`;

    const oldMessage = await readJson(await apiWithD1(env, path, {
      method: "POST",
      headers: groupHeaders("WS", "WS HUILING"),
      body: { date: "2026-07-26", body: "  Bring workbook.  " },
    }), 201);
    assert.equal(oldMessage.body, "Bring workbook.");
    assert.equal(oldMessage.createdBy, TEST_ALLOWED_EMAIL);

    await readJson(await apiWithD1(env, path, {
      method: "POST",
      headers: groupHeaders("WS", "WS HUILING"),
      body: { date: "2026-07-27", body: "Newer note" },
    }), 201);

    const messages = await readJson(await apiWithD1(env, path, {
      headers: groupHeaders("WS", "WS HUILING"),
    }));
    assert.deepEqual(messages.items.map(({ body }) => body), ["Newer note", "Bring workbook."]);
  });
});

test("idempotently retries one enrolment key while allowing real duplicate identities", async () => {
  await withD1(async (env) => {
    const body = {
      name: " NEW STUDENT ",
      grade: " Y3 ",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: emptyProfile,
      enrolmentKey: "10000000-0000-4000-8000-000000000001",
    };
    const created = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    }), 201);
    assert.equal(created.name, "NEW STUDENT");
    assert.equal(created.grade, "Y3");

    const retried = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    }));
    assert.equal(retried.id, created.id);

    const realDuplicate = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body: {
        ...body,
        name: "new student",
        grade: "y3",
        enrolmentKey: "10000000-0000-4000-8000-000000000002",
      },
    }), 201);
    assert.notEqual(realDuplicate.id, created.id);

    const stored = await env.DB.prepare(
      `SELECT id, enrolment_key
       FROM students
       WHERE lower(trim(name)) = 'new student'
       ORDER BY enrolment_key`,
    ).all();
    assert.deepEqual(stored.results.map(({ id, enrolment_key }) => ({ id, enrolment_key })), [
      { id: created.id, enrolment_key: "10000000-0000-4000-8000-000000000001" },
      { id: realDuplicate.id, enrolment_key: "10000000-0000-4000-8000-000000000002" },
    ]);
    const activity = await env.DB.prepare(
      "SELECT student_id, action, actor FROM student_activity WHERE action = 'enrol' ORDER BY student_id",
    ).all();
    assert.deepEqual(activity.results.map(({ action, actor }) => ({ action, actor })), [
      { action: "enrol", actor: TEST_ALLOWED_EMAIL },
      { action: "enrol", actor: TEST_ALLOWED_EMAIL },
    ]);
  });
});

for (const [field, change, headers] of enrolmentConflictCases) {
  test(`rejects a reused enrolment key when ${field} changes without altering the original enrolment`, async () => {
    await withD1(async (env) => {
      const body = {
        name: "ORIGINAL STUDENT",
        grade: "Y3",
        branchCode: "MK",
        groupCode: "MK HAPPY",
        profile: emptyProfile,
        enrolmentKey: "10000000-0000-4000-8000-000000000010",
      };
      const created = await readJson(await apiWithD1(env, "/api/students", {
        method: "POST",
        headers: groupHeaders(),
        body,
      }), 201);

      const conflict = await readJson(await apiWithD1(env, "/api/students", {
        method: "POST",
        headers,
        body: { ...body, ...change },
      }), 409);
      assert.equal(conflict.code, "ENROLMENT_KEY_CONFLICT");

      const stored = await env.DB.prepare(
        `SELECT id, name, grade, branch_code, group_code, profile
         FROM students
         WHERE enrolment_key = ?`,
      ).bind(body.enrolmentKey).all();
      assert.deepEqual(stored.results.map((row) => ({
        ...row,
        profile: JSON.parse(row.profile),
      })), [{
        id: created.id,
        name: body.name,
        grade: body.grade,
        branch_code: body.branchCode,
        group_code: body.groupCode,
        profile: body.profile,
      }]);
      const activity = await env.DB.prepare(
        "SELECT action FROM student_activity WHERE student_id = ?",
      ).bind(created.id).all();
      assert.deepEqual(activity.results.map(({ action }) => action), ["enrol"]);
    });
  });
}

test("binds enrolment retries to the original profile after the current profile changes", async () => {
  await withD1(async (env) => {
    const originalProfile = { ...emptyProfile, school: "ORIGINAL SCHOOL" };
    const updatedProfile = { ...originalProfile, school: "UPDATED SCHOOL" };
    const body = {
      name: "PROFILE RETRY STUDENT",
      grade: "Y3",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: originalProfile,
      enrolmentKey: "10000000-0000-4000-8000-000000000011",
    };
    const created = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    }), 201);
    await readJson(await apiWithD1(env, `/api/students/${created.id}/profile`, {
      method: "PATCH",
      headers: groupHeaders(),
      body: {
        updatedAt: created.updatedAt,
        profile: { school: updatedProfile.school },
      },
    }));

    const originalRetry = await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    });
    const changedRetry = await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body: { ...body, profile: updatedProfile },
    });

    assert.deepEqual([originalRetry.status, changedRetry.status], [200, 409]);
    assert.equal((await originalRetry.json()).id, created.id);
    assert.equal((await changedRetry.json()).code, "ENROLMENT_KEY_CONFLICT");
    const stored = await env.DB.prepare(
      "SELECT profile FROM students WHERE id = ?",
    ).bind(created.id).first();
    assert.deepEqual(JSON.parse(stored.profile), updatedProfile);
    const activity = await env.DB.prepare(
      "SELECT action FROM student_activity WHERE student_id = ? AND action = 'enrol'",
    ).bind(created.id).all();
    assert.deepEqual(activity.results.map(({ action }) => action), ["enrol"]);
  });
});

test("fails closed when the immutable enrolment payload snapshot is malformed", async () => {
  await withD1(async (env) => {
    const body = {
      name: "MALFORMED SNAPSHOT STUDENT",
      grade: "Y3",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: emptyProfile,
      enrolmentKey: "10000000-0000-4000-8000-000000000012",
    };
    const created = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    }), 201);
    await env.DB.prepare(
      "UPDATE student_activity SET details = '{}' WHERE student_id = ? AND action = 'enrol'",
    ).bind(created.id).run();

    const retry = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    }), 409);

    assert.equal(retry.code, "ENROLMENT_KEY_CONFLICT");
    const activity = await env.DB.prepare(
      "SELECT action FROM student_activity WHERE student_id = ? AND action = 'enrol'",
    ).bind(created.id).all();
    assert.deepEqual(activity.results.map(({ action }) => action), ["enrol"]);
  });
});

test("concurrent retries of one enrolment key create one student and one enrol activity", async () => {
  await withD1(async (env) => {
    const body = {
      name: "Concurrent Retry",
      grade: "Y3",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: emptyProfile,
      enrolmentKey: "10000000-0000-4000-8000-000000000003",
    };
    const responses = await Promise.all([
      apiWithD1(env, "/api/students", {
        method: "POST",
        headers: groupHeaders(),
        body,
      }),
      apiWithD1(env, "/api/students", {
        method: "POST",
        headers: groupHeaders(),
        body,
      }),
    ]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 201]);
    const students = await Promise.all(responses.map((response) => response.json()));
    assert.equal(students[0].id, students[1].id);
    const activity = await env.DB.prepare(
      "SELECT student_id, action FROM student_activity WHERE student_id = ?",
    ).bind(students[0].id).all();
    assert.deepEqual(activity.results.map((row) => ({ ...row })), [{
      student_id: students[0].id,
      action: "enrol",
    }]);
  });
});

test("concurrent stop and restore transitions each record exactly one activity", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=WS&group=WS%20HUILING&status=active&limit=1",
    ));
    const student = roster.items[0];
    const headers = groupHeaders("WS", "WS HUILING");
    const stopRequest = () => apiWithD1(env, `/api/students/${student.id}/stop`, {
      method: "POST",
      headers,
      body: {
        name: student.name,
        grade: student.grade,
        groupCode: student.groupCode,
      },
    });
    const stopResponses = await Promise.all([stopRequest(), stopRequest()]);
    assert.deepEqual(stopResponses.map(({ status }) => status).sort(), [200, 409]);

    const restoreRequest = () => apiWithD1(env, `/api/students/${student.id}/restore`, {
      method: "POST",
      headers,
      body: {},
    });
    const restoreResponses = await Promise.all([restoreRequest(), restoreRequest()]);
    assert.deepEqual(restoreResponses.map(({ status }) => status).sort(), [200, 409]);

    const activity = await env.DB.prepare(
      `SELECT action, actor
       FROM student_activity
       WHERE student_id = ?
       ORDER BY rowid`,
    ).bind(student.id).all();
    assert.deepEqual(activity.results.map((row) => ({ ...row })), [
      { action: "stop", actor: TEST_ALLOWED_EMAIL },
      { action: "restore", actor: TEST_ALLOWED_EMAIL },
    ]);
  });
});

test("stop and restore preserve the UUID, profile, attendance, and messages", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20WEN%20XUAN&status=active&search=%E9%BB%84%E5%AE%87%E6%88%90",
    ));
    const original = roster.items[0];
    assert.equal(original.grade, "Y1");
    const headers = groupHeaders("MK", "MK WEN XUAN");
    const profile = await readJson(await apiWithD1(
      env,
      `/api/students/${original.id}/profile`,
      {
        method: "PATCH",
        headers,
        body: {
          updatedAt: original.updatedAt,
          grade: "Y2",
          profile: {
            usualPickupTime: "17:30",
            pickupMethod: "Van",
            vanDriver: "Tong",
            vanHomeTime: "18:00",
          },
        },
      },
    ));
    assert.equal(profile.id, original.id);
    assert.equal(profile.grade, "Y2");
    await readJson(await apiWithD1(
      env,
      `/api/students/${original.id}/attendance/2026-07-27/arrive`,
      { method: "PUT", headers, body: { active: true } },
    ));
    await readJson(await apiWithD1(env, `/api/students/${original.id}/messages`, {
      method: "POST",
      headers,
      body: { date: "2026-07-27", body: "Persistent note" },
    }), 201);

    const stopped = await readJson(await apiWithD1(
      env,
      `/api/students/${original.id}/stop`,
      {
        method: "POST",
        headers,
        body: {
          name: original.name,
          grade: profile.grade,
          groupCode: original.groupCode,
        },
      },
    ));
    assert.equal(stopped.id, original.id);
    assert.equal(stopped.grade, "Y2");
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.profile.usualPickupTime, "17:30");
    assert.equal(stopped.profile.pickupMethod, "Van");
    assert.equal(stopped.profile.vanDriver, "Tong");
    assert.equal(stopped.profile.vanHomeTime, "18:00");

    const stoppedRoster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20WEN%20XUAN&status=stopped",
    ));
    assert.equal(stoppedRoster.items[0].id, original.id);

    const restored = await readJson(await apiWithD1(
      env,
      `/api/students/${original.id}/restore`,
      { method: "POST", headers, body: {} },
    ));
    assert.equal(restored.id, original.id);
    assert.equal(restored.grade, "Y2");
    assert.equal(restored.status, "active");
    assert.equal(restored.profile.usualPickupTime, "17:30");
    assert.equal(restored.profile.pickupMethod, "Van");
    assert.equal(restored.profile.vanDriver, "Tong");
    assert.equal(restored.profile.vanHomeTime, "18:00");
    assert.ok(restored.updatedAt > profile.updatedAt);

    const attendance = await readJson(await apiWithD1(
      env,
      "/api/attendance?branch=MK&group=MK%20WEN%20XUAN&date=2026-07-27",
    ));
    assert.deepEqual(attendance.items.map(({ studentId }) => studentId), [original.id]);
    const messages = await readJson(await apiWithD1(
      env,
      `/api/students/${original.id}/messages`,
      { headers },
    ));
    assert.deepEqual(messages.items.map(({ body }) => body), ["Persistent note"]);
    const activity = await env.DB.prepare(
      `SELECT action, actor
       FROM student_activity
       WHERE student_id = ?
       ORDER BY rowid`,
    ).bind(original.id).all();
    assert.deepEqual(activity.results.map((row) => ({ ...row })), [
      { action: "profile_update", actor: TEST_ALLOWED_EMAIL },
      { action: "stop", actor: TEST_ALLOWED_EMAIL },
      { action: "restore", actor: TEST_ALLOWED_EMAIL },
    ]);
  });
});

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const [request, expectedStatus, expectedAssetCalls] of [
    [
      new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
      401,
      0,
    ],
    [
      new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
      404,
      1,
    ],
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, expectedStatus);
    assert.equal(calls, expectedAssetCalls);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await assert.rejects(access(new URL("../dist/server/auth.js", import.meta.url)));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/db/schema.ts", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0000_daycare_sites.sql", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0001_enrolment_idempotency.sql", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0002_shared_password_access.sql", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0005_ws_huiling_additions.sql", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/meta/_journal.json", import.meta.url));
  const packagedSchema = await import("../dist/db/schema.ts");
  assert.ok(packagedSchema.students);
  assert.ok(packagedSchema.studentActivity);
  assert.ok(packagedSchema.accessLoginAttempts);
  const workerBundle = await readFile(
    new URL("../dist/server/index.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(workerBundle, /from\s+["']jose["']/u);
  assert.match(workerBundle, /\/api\/session\/google/u);
  const hosting = JSON.parse(await readFile(
    new URL("../dist/.openai/hosting.json", import.meta.url),
    "utf8",
  ));
  assert.equal(hosting.project_id, "appgprj_6a673e3afe2c819186da12047e199e5d");
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, null);
});

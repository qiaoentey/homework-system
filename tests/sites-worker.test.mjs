import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { parseRosterCsv, ROSTER_FILES } from "../scripts/import-rosters.mjs";
import worker from "../worker/index.js";
import { createSitesD1 } from "./helpers/sitesD1.mjs";

const noAssetFallback = {
  fetch: async () => new Response("missing", { status: 404 }),
};
const emptyProfile = {
  school: "",
  schoolClass: "",
  usualPickupTime: "",
  pickupMethod: "",
  lateStayMonday: "",
  lateStayTuesday: "",
  lateStayWednesday: "",
  lateStayThursday: "",
  lateStayFriday: "",
};
const approvedCounts = {
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "巧恩 STP": 90,
  "PS STP": 121,
  "SY STP": 50,
  "WS HUILING": 46,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
};

async function api(path, options = {}) {
  return worker.fetch(new Request(`https://example.test${path}`, options), {
    ASSETS: noAssetFallback,
  });
}

async function apiWithD1(env, path, {
  method = "GET",
  body,
  headers = {},
} = {}) {
  return worker.fetch(new Request(`https://example.test${path}`, {
    method,
    headers: {
      "oai-authenticated-user-email": "owner@example.com",
      ...headers,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), {
    ASSETS: noAssetFallback,
    DB: env.DB,
  });
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

test("serves the private Sites operator session and fixed branch catalog before assets", async () => {
  const session = await api("/api/session", {
    headers: { "oai-authenticated-user-email": "owner@example.com" },
  });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { email: "owner@example.com" });

  const catalog = await api("/api/catalog");
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

test("keeps private-site login and logout calls client-compatible no-ops", async () => {
  for (const [path, method] of [
    ["/api/session/google", "POST"],
    ["/api/session/emergency", "POST"],
    ["/api/session", "DELETE"],
  ]) {
    const response = await api(path, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(response.status, 204);
  }
});

test("reports Worker API health without consulting static assets", async () => {
  const response = await api("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
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
    assert.equal(total, 550);

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

test("searches and paginates the 121-student roster with stable cursors", async () => {
  await withD1(async (env) => {
    const first = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=PS%20STP&status=active&limit=500",
    ));
    assert.equal(first.items.length, 50);
    assert.equal(first.total, 121);
    assert.equal(typeof first.nextCursor, "string");

    const second = await readJson(await apiWithD1(
      env,
      `/api/students?branch=STP&group=PS%20STP&status=active&limit=50&cursor=${encodeURIComponent(first.nextCursor)}`,
    ));
    assert.equal(second.items.length, 50);
    assert.equal(new Set([...first.items, ...second.items].map(({ id }) => id)).size, 100);

    const search = await readJson(await apiWithD1(
      env,
      "/api/students?branch=STP&group=PS%20STP&status=active&search=abby",
    ));
    assert.equal(search.total, 1);
    assert.equal(search.items[0].name, "ABBY LEE");

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

    for (const eventCode of ["arrive", "koko"]) {
      const event = await readJson(await apiWithD1(env, `${prefix}/${eventCode}`, {
        method: "PUT",
        headers: groupHeaders(),
        body: { active: true },
      }));
      assert.equal(event.studentId, student.id);
      assert.equal(event.eventCode, eventCode);
      assert.equal(event.active, true);
    }

    const attendance = await readJson(await apiWithD1(
      env,
      "/api/attendance?branch=MK&group=MK%20HAPPY&date=2026-07-27",
    ));
    assert.deepEqual(attendance.items.map(({ eventCode }) => eventCode), ["arrive", "koko"]);

    const summary = await readJson(await apiWithD1(
      env,
      "/api/summary?branch=MK&group=MK%20HAPPY&date=2026-07-27",
    ));
    assert.deepEqual(summary, {
      expected: 82,
      arrived: 1,
      notArrived: 81,
      absent: 0,
      koko: 1,
      unmarked: 81,
    });

    assert.deepEqual(await readJson(await apiWithD1(env, prefix, {
      method: "DELETE",
      headers: groupHeaders(),
    })), { cleared: 2 });
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
          profile: { pickupMethod: "Bus" },
        },
      },
    ));
    assert.equal(seeded.profile.pickupMethod, "Bus");

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
    assert.equal(oldMessage.createdBy, "owner@example.com");

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

test("enrols once and rejects a normalized duplicate", async () => {
  await withD1(async (env) => {
    const body = {
      name: " NEW STUDENT ",
      grade: " Y3 ",
      branchCode: "MK",
      groupCode: "MK HAPPY",
      profile: emptyProfile,
    };
    const created = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body,
    }), 201);
    assert.equal(created.name, "NEW STUDENT");
    assert.equal(created.grade, "Y3");

    const duplicate = await readJson(await apiWithD1(env, "/api/students", {
      method: "POST",
      headers: groupHeaders(),
      body: { ...body, name: "new student", grade: "y3" },
    }), 409);
    assert.equal(duplicate.code, "DUPLICATE_STUDENT");
  });
});

test("stop and restore preserve the UUID, profile, attendance, and messages", async () => {
  await withD1(async (env) => {
    const roster = await readJson(await apiWithD1(
      env,
      "/api/students?branch=MK&group=MK%20WEN%20XUAN&status=active&limit=1",
    ));
    const original = roster.items[0];
    const headers = groupHeaders("MK", "MK WEN XUAN");
    const profile = await readJson(await apiWithD1(
      env,
      `/api/students/${original.id}/profile`,
      {
        method: "PATCH",
        headers,
        body: {
          updatedAt: original.updatedAt,
          profile: { usualPickupTime: "5:30 PM" },
        },
      },
    ));
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
          grade: original.grade,
          groupCode: original.groupCode,
        },
      },
    ));
    assert.equal(stopped.id, original.id);
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.profile.usualPickupTime, "5:30 PM");

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
    assert.equal(restored.status, "active");
    assert.equal(restored.profile.usualPickupTime, "5:30 PM");
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
  for (const [request, expectedAssetCalls] of [
    [
      new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
      0,
    ],
    [
      new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
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

    assert.equal(response.status, 404);
    assert.equal(calls, expectedAssetCalls);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/db/schema.ts", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0000_daycare_sites.sql", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/meta/_journal.json", import.meta.url));
  assert.deepEqual(JSON.parse(await readFile(
    new URL("../dist/.openai/hosting.json", import.meta.url),
    "utf8",
  )), {
    d1: "DB",
    r2: null,
  });
});

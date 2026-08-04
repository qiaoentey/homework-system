import { expect, test } from "@playwright/test";
import { assertExternalMutationSafety } from "./policy.js";

assertExternalMutationSafety({
  externalBaseUrl: process.env.E2E_BASE_URL,
  mutationOptIn: process.env.E2E_DANGER_ALLOW_EXTERNAL_MUTATIONS,
});

const CATALOG = {
  MK: [
    { label: "HAPPY", code: "MK HAPPY" },
    { label: "QIAO EN", code: "MK QIAO EN" },
    { label: "WEN XUAN", code: "MK WEN XUAN" },
  ],
  STP: [
    { label: "巧恩", code: "巧恩 STP" },
    { label: "PS", code: "PS STP" },
    { label: "SY", code: "SY STP" },
    { label: "YUAN NING", code: "YUAN NING STP" },
  ],
  WS: [
    { label: "HUILING", code: "WS HUILING" },
    { label: "JIA WEN", code: "WS JIA WEN" },
    { label: "MIXIN", code: "WS MIXIN" },
  ],
};
async function login(page) {
  await page.goto("/");
  const status = await page.evaluate(async () => (await fetch("/api/session/google", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential: "e2e-google-token" }),
  })).status);
  expect(status).toBe(204);
  await page.reload();
  await expect(page.getByRole("heading", { name: "请选择分院" })).toBeVisible();
}

async function openRoster(page, branch, groupLabel, groupCode) {
  await page.getByRole("button", { name: branch, exact: true }).click();
  await page.getByRole("button", { name: groupLabel, exact: true }).click();
  await expect(page.getByRole("heading", { name: groupCode })).toBeVisible();
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "正在载入名单" }))
    .toHaveCount(0);
}

async function listStudents(page, branchCode, groupCode, status, search = "") {
  return page.evaluate(async ({ branchCode, groupCode, status, search }) => {
    const query = new URLSearchParams({
      branch: branchCode,
      group: groupCode,
      status,
      search,
      limit: "50",
    });
    const response = await fetch(`/api/students?${query}`, {
      headers: {
        "X-Branch-Code": branchCode,
        "X-Group-Code": groupCode,
      },
    });
    return { status: response.status, body: await response.json() };
  }, { branchCode, groupCode, status, search });
}

async function attendanceFor(page, branchCode, groupCode, date) {
  return page.evaluate(async ({ branchCode, groupCode, date }) => {
    const query = new URLSearchParams({
      branch: branchCode,
      group: groupCode,
      date,
    });
    const response = await fetch(`/api/attendance?${query}`, {
      headers: {
        "X-Branch-Code": branchCode,
        "X-Group-Code": groupCode,
      },
    });
    return { status: response.status, body: await response.json() };
  }, { branchCode, groupCode, date });
}

async function messagesFor(page, branchCode, groupCode, studentId) {
  return page.evaluate(async ({ branchCode, groupCode, studentId }) => {
    const response = await fetch(`/api/students/${studentId}/messages`, {
      headers: {
        "X-Branch-Code": branchCode,
        "X-Group-Code": groupCode,
      },
    });
    return { status: response.status, body: await response.json() };
  }, { branchCode, groupCode, studentId });
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("first screen is usable and contains only the three approved branches", async ({
  page,
}, testInfo) => {
  const branchGroup = page.getByRole("group", { name: "分院选择" });
  await expect(branchGroup.getByRole("button")).toHaveText(["MK", "STP", "WS"]);
  await expect(page.getByText("进入后只显示该分院名单")).toBeVisible();
  await expect(page.getByText(/Enrol 学生|停补学生|恢复学生/)).toHaveCount(0);

  if (testInfo.project.name === "mobile-chromium") {
    for (const button of await branchGroup.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
  }
});

test("every branch exposes only its approved teacher groups", async ({ page }) => {
  for (const [branch, groups] of Object.entries(CATALOG)) {
    await page.getByRole("button", { name: branch, exact: true }).click();
    const chooser = page.getByRole("group", { name: `${branch} 老师选择` });
    await expect(chooser.getByRole("button")).toHaveText(groups.map(({ label }) => label));
    const otherLabels = Object.entries(CATALOG)
      .filter(([otherBranch]) => otherBranch !== branch)
      .flatMap(([, otherGroups]) => otherGroups.map(({ label }) => label));
    for (const label of otherLabels) {
      await expect(chooser.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    }
    await page.getByRole("button", { name: "返回分院" }).click();
  }
});

test("MK roster stays branch-scoped and Qiao En has only the approved 40 students", async ({
  page,
}) => {
  await openRoster(page, "MK", "HAPPY", "MK HAPPY");
  await expect(page.getByText("WS HUILING", { exact: true })).toHaveCount(0);
  await expect(page.getByText("PS STP", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "返回老师" }).click();
  await page.getByRole("button", { name: "QIAO EN", exact: true }).click();
  await expect(page.getByText("只显示当前老师的在读学生 · 共 40 名")).toBeVisible();
  await expect(page.getByText("基础班")).toHaveCount(0);

  const result = await listStudents(page, "MK", "MK QIAO EN", "active");
  expect(result.status).toBe(200);
  expect(result.body.total).toBe(40);
  expect(result.body.items.every((student) => (
    student.branchCode === "MK" && student.groupCode === "MK QIAO EN"
  ))).toBe(true);
});

test("Qiao En STP loads all 90 students through browser-safe headers", async ({ page }) => {
  await openRoster(page, "STP", "巧恩", "巧恩 STP");
  await expect(page.getByText("只显示当前老师的在读学生 · 共 90 名")).toBeVisible();
  await expect(page.getByText("名单载入失败，请重试")).toHaveCount(0);
});

test("Yuan Ning STP loads only the approved 43 students", async ({ page }) => {
  await openRoster(page, "STP", "YUAN NING", "YUAN NING STP");
  await expect(page.getByText("只显示当前老师的在读学生 · 共 43 名")).toBeVisible();

  const result = await listStudents(page, "STP", "YUAN NING STP", "active");
  expect(result.status).toBe(200);
  expect(result.body.total).toBe(43);
  expect(result.body.items.every((student) => (
    student.branchCode === "STP" && student.groupCode === "YUAN NING STP"
  ))).toBe(true);
});

test("one tap opens the selected student's editable profile", async ({ page }) => {
  await openRoster(page, "WS", "HUILING", "WS HUILING");
  await page.getByRole("searchbox", { name: "搜索当前班级学生" }).fill("萧时彬");

  const card = page.getByTestId("student-card").filter({ hasText: "萧时彬" });
  await card.getByRole("button", { name: "填写 萧时彬 资料", exact: true }).click();

  const profileHeading = page.getByRole("heading", { name: "萧时彬", exact: true });
  await expect(profileHeading).toBeVisible();
  await expect(profileHeading).toBeInViewport();
  await expect(page.getByLabel("学校", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("学校", { exact: true })).toBeFocused();
});

test("enrol, stop, and restore preserve UUID, profile, attendance, and messages", async ({
  page,
}, testInfo) => {
  await openRoster(page, "MK", "WEN XUAN", "MK WEN XUAN");
  const name = `E2E ${testInfo.project.name.toUpperCase()} ${Date.now()}`;
  const message = `Linked history ${testInfo.project.name}`;
  const attendanceDate = await page.evaluate(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  await page.getByRole("button", { name: "Enrol 学生" }).click();
  const enrol = page.getByRole("dialog", { name: "Enrol 学生" });
  await enrol.getByLabel("学生姓名").fill(name);
  await enrol.getByLabel("年级").selectOption("Y3");
  await enrol.getByLabel("学校", { exact: true }).selectOption("南益");
  await enrol.getByLabel("学校班级", { exact: true }).selectOption("3K");
  await enrol.getByLabel("回家载送", { exact: true }).selectOption("家长");
  const createdResponse = page.waitForResponse((response) => (
    response.url().endsWith("/api/students") &&
    response.request().method() === "POST" &&
    response.status() === 201
  ));
  await enrol.getByRole("button", { name: "保存学生" }).click();
  await createdResponse;
  await expect(page.getByText("学生已加入")).toBeVisible();
  const enrolled = await listStudents(page, "MK", "MK WEN XUAN", "active", name);
  expect(enrolled.body.items).toHaveLength(1);
  const createdId = enrolled.body.items[0].id;
  expect(enrolled.body.items[0].profile).toMatchObject({
    school: "南益",
    schoolClass: "3K",
    pickupMethod: "家长",
  });

  const studentCard = page.getByTestId("student-card").filter({
    has: page.getByRole("button", { name: `选择 ${name}`, exact: true }),
  });
  const arrive = studentCard.getByRole("button", { name: "到", exact: true });
  await arrive.click();
  await expect(studentCard.getByText("已保存")).toBeVisible();
  await studentCard.getByRole("button", { name: `选择 ${name}`, exact: true }).click();
  await page.getByRole("button", { name: "写留言" }).click();
  const messageDialog = page.getByRole("dialog", { name: `${name} 留言` });
  await messageDialog.getByLabel("留言内容").fill(message);
  await messageDialog.getByRole("button", { name: "保存留言" }).click();
  await expect(messageDialog.getByText(message)).toBeVisible();
  await messageDialog.getByRole("button", { name: "关闭" }).click();

  await page.getByRole("button", { name: "停补学生" }).click();
  const stop = page.getByRole("dialog", { name: "停补学生" });
  await stop.getByLabel("学生姓名").fill(name);
  await stop.getByLabel("年级").selectOption("Y3");
  await stop.getByRole("button", { name: "查找学生" }).click();
  await expect(stop.getByText(`${name} · Y3 · MK WEN XUAN`)).toBeVisible();
  await stop.getByRole("button", { name: "确认停补" }).click();
  await expect(page.getByText("学生已停补")).toBeVisible();

  const stopped = await listStudents(page, "MK", "MK WEN XUAN", "stopped", name);
  expect(stopped.body.items).toHaveLength(1);
  expect(stopped.body.items[0].id).toBe(createdId);

  await page.getByRole("button", { name: "恢复学生" }).click();
  const restore = page.getByRole("dialog", { name: "恢复学生" });
  await restore.getByLabel(`${name} · Y3 · MK WEN XUAN`).check();
  await restore.getByRole("button", { name: "确认恢复" }).click();
  await expect(page.getByText("学生已恢复")).toBeVisible();

  const active = await listStudents(page, "MK", "MK WEN XUAN", "active", name);
  expect(active.body.items).toHaveLength(1);
  expect(active.body.items[0].id).toBe(createdId);
  expect(active.body.items[0].profile).toMatchObject({
    school: "南益",
    schoolClass: "3K",
    pickupMethod: "家长",
  });

  const attendance = await attendanceFor(
    page,
    "MK",
    "MK WEN XUAN",
    attendanceDate,
  );
  expect(attendance.status).toBe(200);
  expect(attendance.body.items).toContainEqual(expect.objectContaining({
    studentId: createdId,
    date: attendanceDate,
    eventCode: "arrive",
    active: true,
  }));

  const messages = await messagesFor(page, "MK", "MK WEN XUAN", createdId);
  expect(messages.status).toBe(200);
  expect(messages.body.items).toContainEqual(expect.objectContaining({
    studentId: createdId,
    date: attendanceDate,
    body: message,
  }));
});

test("failed attendance can be retried without leaving stale optimistic state", async ({
  page,
}) => {
  await openRoster(page, "MK", "WEN XUAN", "MK WEN XUAN");
  let attempts = 0;
  await page.route("**/api/students/*/attendance/*/*", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "E2E_TRANSIENT", error: "Temporary failure" }),
      });
    } else {
      await route.continue();
    }
  });

  const card = page.getByTestId("student-card").first();
  const arrive = card.getByRole("button", { name: "到", exact: true });
  const previous = await arrive.getAttribute("aria-pressed");
  await arrive.click();
  await expect(card.getByText("保存失败")).toBeVisible();
  await expect(arrive).toHaveAttribute("aria-pressed", previous);
  await card.getByRole("button", { name: "重试", exact: true }).click();
  await expect(card.getByText("已保存")).toBeVisible();
  await expect(arrive).toHaveAttribute(
    "aria-pressed",
    previous === "true" ? "false" : "true",
  );
  expect(attempts).toBe(2);
});

test("attendance records show the saved current-class result without a pickup event", async ({
  page,
}) => {
  await openRoster(page, "MK", "WEN XUAN", "MK WEN XUAN");

  const card = page.getByTestId("student-card").first();
  const studentName = (await card.locator(".student-card__identity strong").textContent()).trim();
  await expect(card.getByRole("button", { name: "接", exact: true })).toHaveCount(0);

  const arrive = card.getByRole("button", { name: "到", exact: true });
  if (await arrive.getAttribute("aria-pressed") !== "true") {
    await arrive.click();
    await expect(card.getByText("已保存")).toBeVisible();
  }

  await page.getByRole("button", { name: "点名记录" }).click();
  const dialog = page.getByRole("dialog", { name: "点名记录" });
  await expect(dialog.getByRole("heading", { name: /出席 \d+/ })).toBeVisible();
  await expect(dialog.getByText(studentName, { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("记录日期")).not.toHaveValue("");
});

test("empty search clears the previous profile and removes its save action", async ({
  page,
}) => {
  await openRoster(page, "WS", "HUILING", "WS HUILING");
  const card = page.getByTestId("student-card").first();
  await card.locator(".student-card__identity").click();
  await expect(page.getByRole("button", { name: "保存学生资料" })).toBeVisible();

  await page.getByRole("searchbox", { name: "搜索当前班级学生" }).fill("ZZZ_NO_MATCH");
  await expect(page.getByText("找不到学生")).toBeVisible();
  await expect(page.getByRole("heading", { name: "请选择学生" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存学生资料" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "写留言" })).toHaveCount(0);
  for (const input of await page.locator(".profile-form input").all()) {
    await expect(input).toHaveValue("");
  }
});

test("logout clears the signed session and returns to login", async ({ page }) => {
  await page.getByRole("button", { name: "STP", exact: true }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("heading", { name: "登录点名系统" })).toBeVisible();
  const sessionStatus = await page.evaluate(async () => (await fetch("/api/session")).status);
  expect(sessionStatus).toBe(401);
});

test("API rejects a branch and teacher-group mismatch", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const response = await fetch(
      "/api/students?branch=WS&group=MK%20HAPPY&status=active&limit=50",
      {
        headers: {
          "X-Branch-Code": "WS",
          "X-Group-Code": "MK HAPPY",
        },
      },
    );
    return { status: response.status, body: await response.json() };
  });
  expect(result).toEqual({
    status: 400,
    body: {
      code: "GROUP_BRANCH_MISMATCH",
      error: "Group does not belong to branch",
    },
  });
});

test("the 83-student PS roster mounts only a virtual window of cards", async ({ page }) => {
  await openRoster(page, "STP", "PS", "PS STP");
  await expect(page.getByText("只显示当前老师的在读学生 · 共 83 名")).toBeVisible();
  const mountedCards = page.getByTestId("student-card");
  await expect(mountedCards.first()).toBeVisible();
  expect(await mountedCards.count()).toBeLessThan(30);
});

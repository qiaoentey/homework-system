# Roster Today Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current point-marking date clearly beneath every roster class title.

**Architecture:** Keep the existing `RosterScreen` date parameter as the single source of truth. Format that local `YYYY-MM-DD` value inside the roster component, render it with a semantic `time` element, and add one responsive class using the existing brand tokens.

**Tech Stack:** React 19, CSS, Vitest, Testing Library, Vite, Sites.

## Global Constraints

- Display copy must follow `今天 · 2026年8月10日 · 星期一`.
- The machine-readable date must remain `YYYY-MM-DD` on a `time` element.
- Do not add a server request, dependency, database column, or separate date state.
- The label must fit the existing desktop and mobile roster header.

---

### Task 1: Add the roster date label

**Files:**
- Modify: `tests/client/roster.test.jsx`
- Modify: `src/features/roster/RosterScreen.jsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `RosterScreen({ date })`, where `date` is a local `YYYY-MM-DD` string.
- Produces: one visible `.roster-screen__date` element containing `<time dateTime={date}>`.

- [ ] **Step 1: Write the failing test**

Add this test inside `virtualized current-group roster`:

```jsx
it("shows the point-marking date below the class title", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url.startsWith("/api/students?")) {
      return jsonResponse(200, { items: [student(1)], nextCursor: null, total: 1 });
    }
    return rosterSupport(url);
  }));

  render(<RosterScreen branchCode="STP" groupCode="PS STP" date="2026-08-10" />);

  const date = screen.getByText("今天 · 2026年8月10日 · 星期一");
  expect(date).toBeVisible();
  expect(date).toHaveAttribute("datetime", "2026-08-10");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
./node_modules/.bin/vitest run tests/client/roster.test.jsx -t "shows the point-marking date"
```

Expected: FAIL because the date text is absent.

- [ ] **Step 3: Implement the minimal date formatter and label**

In `RosterScreen.jsx`, add a weekday constant and formatter that parses numeric year, month, and day without UTC conversion:

```jsx
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function rosterDateLabel(date) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `今天 · ${year}年${month}月${day}日 · ${weekday}`;
}
```

Render beneath `<h1>{groupCode}</h1>`:

```jsx
<time className="roster-screen__date" dateTime={date}>
  {rosterDateLabel(date)}
</time>
```

In `app.css`, style the class as an inline blue-tinted badge using existing variables, with no fixed width:

```css
.roster-screen__date {
  display: inline-flex;
  margin-top: 12px;
  border-radius: 999px;
  background: rgba(23, 104, 209, 0.1);
  color: var(--color-blue);
  padding: 7px 11px;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.2;
}
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
./node_modules/.bin/vitest run tests/client/roster.test.jsx -t "shows the point-marking date"
npm test -- --maxWorkers=1 --reporter=dot
npm run build
npm run test:sites
```

Expected: the focused test and all existing suites pass; production artifacts are emitted.

- [ ] **Step 5: Commit and publish**

```bash
git add tests/client/roster.test.jsx src/features/roster/RosterScreen.jsx src/styles/app.css
git commit -m "feat: show today's date on roster"
```

Push the exact commit, package the validated build, save a new Sites version, deploy it publicly, and confirm `https://daycarecheckin.cyedu.biz/api/health` returns `{"ok":true}`.

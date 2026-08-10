# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Roster profile editing must have an obvious one-action entry on every student card. Avoid requiring teachers to discover that the student's name is a selector or to scroll manually to unlock the profile form.

Student profile entry must preserve the original STP controlled choices: fixed schools, grade-aware school-class options, time controls, parent/Van transport, Van details, and weekday stay-time choices. Use the same profile controls for existing students and Enrol.

Dashboard student rows must show every daily point-marking item in the same order as the roster buttons. Active items change color, inactive items stay gray, and legacy KOKO records remain hidden.

Marking a student absent must require one of these reasons: 生病、旅行、校外比赛、家事、其他. “其他” requires teacher-entered text, and the saved reason must remain visible on the roster, Dashboard, and dated attendance records.

MK 姚贞暖学校班级选项为：二年级 2B、三年级 3H、四年级 4Y、六年级 6W；其他年级暂时不提供班级选项。

STP 学校选项额外包含 SMK Danau Kota；该学校暂时不提供学校班级选项，并且不得出现在 WS 或 MK。

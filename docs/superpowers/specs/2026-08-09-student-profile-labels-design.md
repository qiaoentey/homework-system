# Student Profile Labels Design

## Goal

Show useful saved profile details beside each student name so teachers can see school, class, transport, homework-class, dinner, and late-stay arrangements without opening the profile form.

## Display design

- Show the saved school and school class as neutral text below the student's name and grade, for example `启智 · 1J`.
- Show profile labels in the same identity area. Labels wrap onto additional lines on narrow screens so the name and attendance buttons remain usable.
- Use four distinct label treatments:
  - Van transport: green icon and green-tinted label.
  - Homework class: orange icon and orange-tinted label.
  - Dinner: red icon and red-tinted label.
  - Late stay: yellow icon and yellow-tinted label.
- Use compact letter icons drawn with CSS and text (`V`, `功`, `餐`, `留`); do not add image or SVG assets.

## Label rules

### Van transport

Show only when `pickupMethod` is `Van`. Include the saved driver, `平日`, and the saved Van return time. Fall back to the usual pickup time only when the Van return time is blank. Omit any missing detail instead of showing placeholder text.

Example: `Van载送 · Uncle Kent · 平日 · 17:00`.

### Homework class

Show only when `careProgram` is `功课班`. Include every weekday whose homework field is `有来`. If both arrival and departure times exist, show a time range; otherwise identify the available time as `来` or `回`.

Example: `功课班 · 周一、三、五 · 14:00–18:00`.

### Dinner

Show only when `dinnerRequired` is `需要`. Include every weekday whose dinner field is `需要`. Dinner has no saved time field, so the label must not invent a time.

Example: `晚餐 · 周一、三`.

### Late stay

Show when at least one late-stay weekday has a saved time. Group weekdays that share the same time to keep the label compact.

Example: `留校 · 周一、三 17:00 · 周五 18:00`.

## Data and compatibility

- Read only the profile fields already returned with each student; no schema, API, or migration change is needed.
- Keep the existing pickup summary and all attendance controls unchanged.
- Empty or partially completed profiles render only the information that exists.

## Accessibility and responsive behavior

- Each label has a readable text name and an accessible label; color is not the only identifier.
- Labels may wrap, but do not horizontally scroll or truncate schedule details.
- On small screens, reduce padding and icon size while keeping touch targets and attendance controls unchanged.

## Verification

- Add a roster test that supplies all four kinds of profile data and verifies the school/class and exact schedule summaries.
- Add a partial-profile test proving labels omit missing details and absent label types.
- Run the full client/server test suite, Sites Worker tests, production build, and desktop/mobile end-to-end tests.


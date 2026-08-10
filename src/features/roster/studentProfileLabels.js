const WEEKDAYS = [
  { short: "一", van: "vanMonday", homework: "homeworkMonday", dinner: "dinnerMonday", stay: "lateStayMonday" },
  { short: "二", van: "vanTuesday", homework: "homeworkTuesday", dinner: "dinnerTuesday", stay: "lateStayTuesday" },
  { short: "三", van: "vanWednesday", homework: "homeworkWednesday", dinner: "dinnerWednesday", stay: "lateStayWednesday" },
  { short: "四", van: "vanThursday", homework: "homeworkThursday", dinner: "dinnerThursday", stay: "lateStayThursday" },
  { short: "五", van: "vanFriday", homework: "homeworkFriday", dinner: "dinnerFriday", stay: "lateStayFriday" },
];

const DETENTION_OPTIONS = ["听写留堂", "功课留堂", "不可以留堂"];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function displayTime(value) {
  const normalized = clean(value);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(normalized);
  if (!match) return normalized;

  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

function weekdaySummary(profile, field, activeValue) {
  const days = WEEKDAYS
    .filter((day) => clean(profile?.[day[field]]) === activeValue)
    .map((day) => day.short);
  return days.length > 0 ? `周${days.join("、")}` : "";
}

function vanScheduleDetails(profile) {
  const fallbackTime = clean(profile?.vanHomeTime) || clean(profile?.usualPickupTime);
  const activeDays = WEEKDAYS.flatMap((day) => {
    const savedValue = clean(profile?.[day.van]);
    if (!savedValue) return [];
    return [{
      short: day.short,
      time: savedValue === "需要" ? fallbackTime : savedValue,
      legacy: savedValue === "需要",
    }];
  });

  if (activeDays.length === 0) {
    return ["平日", displayTime(fallbackTime)];
  }

  if (activeDays.every((day) => day.legacy)) {
    return [
      `周${activeDays.map((day) => day.short).join("、")}`,
      displayTime(fallbackTime),
    ];
  }

  const daysByTime = new Map();
  for (const day of activeDays) {
    const days = daysByTime.get(day.time) ?? [];
    days.push(day.short);
    daysByTime.set(day.time, days);
  }
  return [...daysByTime].map(([time, days]) => [
    `周${days.join("、")}`,
    displayTime(time),
  ].filter(Boolean).join(" "));
}

function homeworkTimeSummary(profile) {
  const arrival = clean(profile?.homeworkArrivalTime);
  const departure = clean(profile?.homeworkDepartureTime);
  if (arrival && departure) return `${arrival}–${departure}`;
  if (arrival) return `来 ${arrival}`;
  if (departure) return `回 ${departure}`;
  return "";
}

function staySummaries(profile) {
  const daysByTime = new Map();
  for (const day of WEEKDAYS) {
    const time = clean(profile?.[day.stay]);
    if (!time) continue;
    const days = daysByTime.get(time) ?? [];
    days.push(day.short);
    daysByTime.set(time, days);
  }
  return [...daysByTime].map(([time, days]) => `周${days.join("、")} ${time}`);
}

function dinnerSummaries(profile) {
  return [
    ["小", "小"],
    ["大", "大"],
    ["需要", "未选大小"],
  ].flatMap(([value, label]) => {
    const days = WEEKDAYS
      .filter((day) => clean(profile?.[day.dinner]) === value)
      .map((day) => day.short);
    return days.length > 0 ? [`${label}：周${days.join("、")}`] : [];
  });
}

function needsDinner(profile) {
  if (clean(profile?.dinnerRequired) === "需要") return true;
  return WEEKDAYS.some((day) => ["小", "大", "需要"].includes(
    clean(profile?.[day.dinner]),
  ));
}

function detentionSummary(profile) {
  const selected = new Set(clean(profile?.detentionType).split("|").filter(Boolean));
  return DETENTION_OPTIONS.filter((option) => selected.has(option)).join("、");
}

function profileLabel(kind, icon, title, details = []) {
  const text = [title, ...details.filter(Boolean)].join(" · ");
  return { kind, icon, text, ariaLabel: text };
}

export function studentSchoolSummary(profile) {
  return [clean(profile?.school), clean(profile?.schoolClass)].filter(Boolean).join(" · ");
}

export function studentProfileLabels(profile) {
  const labels = [];

  if (clean(profile?.pickupMethod).toLowerCase() === "van") {
    labels.push(profileLabel("van", "V", "Van载送", [
      clean(profile?.vanDriver),
      ...vanScheduleDetails(profile),
    ]));
  }

  if (clean(profile?.careProgram) === "功课班") {
    labels.push(profileLabel("homework", "功", "功课班", [
      weekdaySummary(profile, "homework", "有来"),
      homeworkTimeSummary(profile),
    ]));
  }

  if (needsDinner(profile)) {
    labels.push(profileLabel("dinner", "餐", "需要晚餐", dinnerSummaries(profile)));
  }

  const stayDetails = staySummaries(profile);
  if (stayDetails.length > 0) {
    labels.push(profileLabel("stay", "留", "留校", stayDetails));
  }

  const showerRequired = clean(profile?.showerRequired);
  if (showerRequired === "需要" || showerRequired === "不需要") {
    labels.push(profileLabel("shower", "澡", "洗澡", [showerRequired]));
  }

  const detention = detentionSummary(profile);
  if (detention) {
    labels.push(profileLabel("detention", "堂", "留堂事项", [detention]));
  }

  const specialNotes = [
    ["specialNoteHighC", "高c"],
    ["specialNoteDailyHomeworkPhoto", "一定要每天拍照功课进群组给家长"],
    ["specialNoteNotifyIncompleteHomework", "来不及完成功课一定要通知家长"],
  ];
  for (const [field, note] of specialNotes) {
    if (clean(profile?.[field]) === "需要") {
      labels.push(profileLabel("note", "备", "特别备注", [note]));
    }
  }
  const otherNote = clean(profile?.specialNoteOther);
  if (otherNote) labels.push(profileLabel("note", "备", "特别备注", [otherNote]));

  return labels;
}

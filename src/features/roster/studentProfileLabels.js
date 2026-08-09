const WEEKDAYS = [
  { short: "一", van: "vanMonday", homework: "homeworkMonday", dinner: "dinnerMonday", stay: "lateStayMonday" },
  { short: "二", van: "vanTuesday", homework: "homeworkTuesday", dinner: "dinnerTuesday", stay: "lateStayTuesday" },
  { short: "三", van: "vanWednesday", homework: "homeworkWednesday", dinner: "dinnerWednesday", stay: "lateStayWednesday" },
  { short: "四", van: "vanThursday", homework: "homeworkThursday", dinner: "dinnerThursday", stay: "lateStayThursday" },
  { short: "五", van: "vanFriday", homework: "homeworkFriday", dinner: "dinnerFriday", stay: "lateStayFriday" },
];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function weekdaySummary(profile, field, activeValue) {
  const days = WEEKDAYS
    .filter((day) => clean(profile?.[day[field]]) === activeValue)
    .map((day) => day.short);
  return days.length > 0 ? `周${days.join("、")}` : "";
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
      weekdaySummary(profile, "van", "需要") || "平日",
      clean(profile?.vanHomeTime) || clean(profile?.usualPickupTime),
    ]));
  }

  if (clean(profile?.careProgram) === "功课班") {
    labels.push(profileLabel("homework", "功", "功课班", [
      weekdaySummary(profile, "homework", "有来"),
      homeworkTimeSummary(profile),
    ]));
  }

  if (clean(profile?.dinnerRequired) === "需要") {
    labels.push(profileLabel("dinner", "餐", "晚餐", [
      weekdaySummary(profile, "dinner", "需要"),
    ]));
  }

  const stayDetails = staySummaries(profile);
  if (stayDetails.length > 0) {
    labels.push(profileLabel("stay", "留", "留校", stayDetails));
  }

  const showerRequired = clean(profile?.showerRequired);
  if (showerRequired === "需要" || showerRequired === "不需要") {
    labels.push(profileLabel("shower", "澡", "洗澡", [showerRequired]));
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

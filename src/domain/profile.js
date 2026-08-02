export const PROFILE_FIELDS = [
  ["school", "学校"],
  ["schoolClass", "学校班级"],
  ["usualPickupTime", "平常回家时间"],
  ["pickupMethod", "回家载送"],
  ["vanDriver", "Van 司机"],
  ["vanHomeTime", "Van 回程时间"],
  ["lateStayMonday", "星期一"],
  ["lateStayTuesday", "星期二"],
  ["lateStayWednesday", "星期三"],
  ["lateStayThursday", "星期四"],
  ["lateStayFriday", "星期五"],
];

export const EMPTY_PROFILE = Object.fromEntries(
  PROFILE_FIELDS.map(([field]) => [field, ""]),
);

export function normalizeProfile(profile) {
  return Object.fromEntries(
    PROFILE_FIELDS.map(([field]) => [field, profile?.[field] ?? ""]),
  );
}

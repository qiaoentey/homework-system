export const PROFILE_FIELDS = [
  ["school", "学校"],
  ["schoolClass", "学校班级"],
  ["usualPickupTime", "平时接送时间"],
  ["pickupMethod", "接送方式"],
  ["lateStayMonday", "星期一延时"],
  ["lateStayTuesday", "星期二延时"],
  ["lateStayWednesday", "星期三延时"],
  ["lateStayThursday", "星期四延时"],
  ["lateStayFriday", "星期五延时"],
];

export const EMPTY_PROFILE = Object.fromEntries(
  PROFILE_FIELDS.map(([field]) => [field, ""]),
);

export function normalizeProfile(profile) {
  return Object.fromEntries(
    PROFILE_FIELDS.map(([field]) => [field, profile?.[field] ?? ""]),
  );
}

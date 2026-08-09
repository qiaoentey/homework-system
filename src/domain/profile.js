export const PROFILE_FIELDS = [
  ["school", "学校"],
  ["schoolClass", "学校班级"],
  ["usualPickupTime", "平常回家时间"],
  ["pickupMethod", "回家载送"],
  ["vanDriver", "Van 司机"],
  ["vanHomeTime", "Van 载送时间"],
  ["vanMonday", "星期一 Van"],
  ["vanTuesday", "星期二 Van"],
  ["vanWednesday", "星期三 Van"],
  ["vanThursday", "星期四 Van"],
  ["vanFriday", "星期五 Van"],
  ["dinnerRequired", "是否需要晚餐"],
  ["dinnerMonday", "星期一晚餐"],
  ["dinnerTuesday", "星期二晚餐"],
  ["dinnerWednesday", "星期三晚餐"],
  ["dinnerThursday", "星期四晚餐"],
  ["dinnerFriday", "星期五晚餐"],
  ["lateStayMonday", "星期一"],
  ["lateStayTuesday", "星期二"],
  ["lateStayWednesday", "星期三"],
  ["lateStayThursday", "星期四"],
  ["lateStayFriday", "星期五"],
  ["careProgram", "学生类型"],
  ["homeworkArrivalTime", "来校时间"],
  ["homeworkDepartureTime", "回家时间"],
  ["homeworkMonday", "星期一有来"],
  ["homeworkTuesday", "星期二有来"],
  ["homeworkWednesday", "星期三有来"],
  ["homeworkThursday", "星期四有来"],
  ["homeworkFriday", "星期五有来"],
  ["showerRequired", "洗澡"],
  ["detentionType", "留堂"],
  ["specialNoteHighC", "高c"],
  ["specialNoteDailyHomeworkPhoto", "一定要每天拍照功课进群组给家长"],
  ["specialNoteNotifyIncompleteHomework", "来不及完成功课一定要通知家长"],
  ["specialNoteOther", "其他备注"],
];

export const EMPTY_PROFILE = Object.fromEntries(
  PROFILE_FIELDS.map(([field]) => [field, ""]),
);

export function normalizeProfile(profile) {
  return Object.fromEntries(
    PROFILE_FIELDS.map(([field]) => [field, profile?.[field] ?? ""]),
  );
}

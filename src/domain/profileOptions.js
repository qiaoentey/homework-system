export const SCHOOL_OPTIONS = [
  "南益",
  "民义",
  "旺小",
  "桥南",
  "中华小学",
  "中华中学",
];

export const STUDENT_GRADE_OPTIONS = [
  "K1",
  "K2",
  "K1+K2",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "Y1",
  "Y2",
  "Y3",
  "Y4",
  "Y5",
  "Y6",
  "幼儿班",
  "一年级",
  "二年级",
  "三年级",
  "四年级",
  "五年级",
  "六年级",
];

const MK_SCHOOL_OPTIONS = ["一校", "二校", "启智", "姚贞暖", "幼儿园"];
const STP_SCHOOL_OPTIONS = [...SCHOOL_OPTIONS, "SMK Danau Kota"];

const MK_SCHOOL_CLASSES = {
  一校: {
    1: ["1B", "1M", "1U"],
    2: ["2B", "2M", "2U"],
    3: ["3J", "3B", "3M", "3U"],
    4: ["4B", "4M", "4U"],
    5: ["5B", "5M", "5U"],
    6: ["6B", "6M", "6U"],
  },
  二校: Object.fromEntries([1, 2, 3, 4, 5, 6].map((year) => [
    String(year),
    [`${year}W`, `${year}I`, `${year}S`],
  ])),
  启智: Object.fromEntries([1, 2, 3, 4, 5, 6].map((year) => [
    String(year),
    [`${year}C`, `${year}J`, `${year}B`],
  ])),
  姚贞暖: {
    2: ["2B"],
    3: ["3H"],
    4: ["4Y"],
    6: ["6W"],
  },
};

const SCHOOL_CLASS_SUFFIXES = {
  南益: ["K", "H", "B", "M", "U", "J", "C"],
  民义: ["M", "K", "J", "B", "H", "U", "P"],
  旺小: ["坚", "持", "传", "承", "延", "续"],
  桥南: ["M", "K"],
  中华小学: ["礼", "义", "廉"],
  中华中学: ["S", "M", "J", "K", "C", "H", "O", "N", "G", "W", "A"],
};

const CHINESE_PRIMARY_GRADES = {
  一年级: "1",
  二年级: "2",
  三年级: "3",
  四年级: "4",
  五年级: "5",
  六年级: "6",
};

export const PICKUP_METHOD_OPTIONS = ["家长", "Van"];

export const VAN_DRIVER_OPTIONS = [
  "Tong",
  "Lam",
  "Lim",
  "Kent",
  "Wong",
  "Boon",
  "Aunty Lily",
  "Liew",
];

const MK_VAN_DRIVER_OPTIONS = [
  "Mr Kent",
  "Uncle Yeow",
  "Uncle Sam",
  "Uncle Leong",
  "Uncle Ting",
  "Uncle Tan",
  "Uncle Law",
];

const WS_VAN_DRIVER_OPTIONS = [
  "Uncle Liew",
  "Uncle Chan",
  "Aunty Airine",
];

const STP_VAN_DRIVER_OPTIONS = ["Aunty Airine"];

export const STAY_TIME_OPTIONS = [
  ["", "不留校"],
  ["15:30", "3:30 PM"],
  ["16:00", "4:00 PM"],
  ["17:00", "5:00 PM"],
];

const MK_SECOND_SCHOOL_STAY_TIME_OPTIONS = [
  ["", "不留校"],
  ["15:20", "3:20 PM"],
  ["16:00", "4:00 PM"],
  ["17:00", "5:00 PM"],
];

const MK_QIZHI_STAY_TIME_OPTIONS = [
  ["", "不留校"],
  ["14:00", "2:00 PM"],
  ["15:30", "3:30 PM"],
  ["16:00", "4:00 PM"],
  ["17:00", "5:00 PM"],
];

export function stayTimeOptionsFor(branchCode, school) {
  let options = STAY_TIME_OPTIONS;
  if (branchCode === "MK" && school === "二校") {
    options = MK_SECOND_SCHOOL_STAY_TIME_OPTIONS;
  } else if (branchCode === "MK" && school === "启智") {
    options = MK_QIZHI_STAY_TIME_OPTIONS;
  }
  return options.map(([value, label]) => [value, label]);
}

function gradePrefix(grade) {
  if (CHINESE_PRIMARY_GRADES[grade]) return CHINESE_PRIMARY_GRADES[grade];
  if (/^Y[1-6]$/.test(grade)) return grade.slice(1);
  if (/^F[1-6]$/.test(grade)) return grade;
  return "";
}

export function schoolOptionsFor(branchCode) {
  if (branchCode === "MK") return [...MK_SCHOOL_OPTIONS];
  if (branchCode === "STP") return [...STP_SCHOOL_OPTIONS];
  return [...SCHOOL_OPTIONS];
}

export function vanDriverOptionsFor(branchCode) {
  if (branchCode === "MK") {
    return [...VAN_DRIVER_OPTIONS, ...MK_VAN_DRIVER_OPTIONS];
  }
  if (branchCode === "WS") {
    return [...VAN_DRIVER_OPTIONS, ...WS_VAN_DRIVER_OPTIONS];
  }
  if (branchCode === "STP") {
    return [...VAN_DRIVER_OPTIONS, ...STP_VAN_DRIVER_OPTIONS];
  }
  return [...VAN_DRIVER_OPTIONS];
}

export function schoolClassesFor(branchCode, school, grade) {
  const prefix = gradePrefix(grade);
  if (branchCode === "MK") {
    return [...(MK_SCHOOL_CLASSES[school]?.[prefix] ?? [])];
  }
  const suffixes = SCHOOL_CLASS_SUFFIXES[school] ?? [];
  if (!prefix) return [];
  return suffixes.map((suffix) => `${prefix}${suffix}`);
}

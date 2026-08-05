export const SCHOOL_OPTIONS = [
  "南益",
  "民义",
  "旺小",
  "桥南",
  "中华小学",
  "中华中学",
];

const MK_SCHOOL_OPTIONS = ["一校", "二校", "启智", "姚贞暖"];

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

export const STAY_TIME_OPTIONS = [
  ["", "不留校"],
  ["15:30", "3:30 PM"],
  ["16:00", "4:00 PM"],
  ["17:00", "5:00 PM"],
];

function gradePrefix(grade) {
  if (CHINESE_PRIMARY_GRADES[grade]) return CHINESE_PRIMARY_GRADES[grade];
  if (/^Y[1-6]$/.test(grade)) return grade.slice(1);
  if (/^F[1-6]$/.test(grade)) return grade;
  return "";
}

export function schoolOptionsFor(branchCode) {
  return branchCode === "MK" ? [...MK_SCHOOL_OPTIONS] : [...SCHOOL_OPTIONS];
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

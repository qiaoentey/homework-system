export const ABSENCE_REASON_OPTIONS = [
  "生病",
  "旅行",
  "校外比赛",
  "家事",
  "其他",
];

const FIXED_ABSENCE_REASONS = new Set(ABSENCE_REASON_OPTIONS.slice(0, 4));

export function normalizeAbsenceReason(value) {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason && reason.length <= 100 ? reason : null;
}

export function formatAbsenceReason(value) {
  const reason = normalizeAbsenceReason(value);
  if (!reason) return "";
  return FIXED_ABSENCE_REASONS.has(reason) ? reason : `其他：${reason}`;
}

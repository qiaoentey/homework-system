export function decodeHeaderValue(value) {
  if (typeof value !== "string") return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

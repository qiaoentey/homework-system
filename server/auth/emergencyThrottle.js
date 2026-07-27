const DEFAULT_MAX_FAILURES = 5;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createEmergencyThrottle({
  maxFailures = DEFAULT_MAX_FAILURES,
  lockoutMs = DEFAULT_LOCKOUT_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = Date.now,
} = {}) {
  const failureLimit = positiveInteger(maxFailures, DEFAULT_MAX_FAILURES);
  const lockDuration = positiveInteger(lockoutMs, DEFAULT_LOCKOUT_MS);
  const entryLimit = positiveInteger(maxEntries, DEFAULT_MAX_ENTRIES);
  const entries = new Map();

  function pruneExpired(timestamp) {
    for (const [ip, entry] of entries) {
      if (entry.blockedUntil > 0 && entry.blockedUntil <= timestamp) entries.delete(ip);
    }
  }

  function retryAfter(ip) {
    const timestamp = now();
    pruneExpired(timestamp);
    const entry = entries.get(ip);
    if (!entry || entry.blockedUntil === 0 || entry.blockedUntil <= timestamp) return 0;
    return Math.max(1, Math.ceil((entry.blockedUntil - timestamp) / 1000));
  }

  function recordFailure(ip) {
    const timestamp = now();
    pruneExpired(timestamp);
    let entry = entries.get(ip);
    if (!entry) {
      if (entries.size >= entryLimit) {
        entries.delete(entries.keys().next().value);
      }
      entry = { failures: 0, blockedUntil: 0 };
      entries.set(ip, entry);
    }
    entry.failures += 1;
    entry.blockedUntil = entry.failures >= failureLimit
      ? timestamp + lockDuration
      : 0;
  }

  function reset(ip) {
    entries.delete(ip);
  }

  return { recordFailure, reset, retryAfter };
}

CREATE TABLE IF NOT EXISTS access_login_attempts (
  address_hash TEXT PRIMARY KEY NOT NULL,
  failures INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS access_login_attempts_updated_at_idx
  ON access_login_attempts (updated_at);

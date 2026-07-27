# Daycare check-in operations

This runbook covers the optimized Node/React service and its PostgreSQL database. Run production commands only from an authorized Render shell or an operator workstation with access to the intended service and database. Never copy secret values into source control or command output.

## Deployment prerequisites

Before a first deployment or replacement deployment, confirm:

- the intended Git repository and branch are connected to Render;
- the operator can create deployments, inspect logs, roll back the web service, and access the PostgreSQL database;
- the target is identified as either a new optimized service or the existing service being replaced;
- all environment variables listed below are configured in Render;
- the Google OAuth client allows the production website origin and every authorized account is in `ALLOWED_EMAILS`;
- an operator can create and retrieve a PostgreSQL backup before migrations;
- Playwright smoke checks are authorized against the production URL.

The repository's `render.yaml` creates `daycare-checkin-optimized` and `daycare-checkin-db`. It does not prove that an existing Render URL will be replaced.

## Required environment variable names

Configure these names without committing their values:

```text
DATABASE_URL
SESSION_SECRET
GOOGLE_CLIENT_ID
VITE_GOOGLE_CLIENT_ID
ALLOWED_EMAILS
EMERGENCY_PASSWORD_HASH
PORT
NODE_ENV
NODE_VERSION
```

`SESSION_SECRET` must be a non-placeholder value of at least 32 characters. `ALLOWED_EMAILS` is a comma-separated allowlist. `EMERGENCY_PASSWORD_HASH` uses the `salt:hex-encoded-scrypt-hash` format. `GOOGLE_CLIENT_ID` verifies server-side Google tokens; `VITE_GOOGLE_CLIENT_ID` supplies the same public OAuth client ID to the browser build. Render supplies `DATABASE_URL`; its blueprint pins `NODE_VERSION` separately.

## Pre-deploy backup

Create the backup before a deployment whose build runs migrations:

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backups/daycare-predeploy-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Record the backup filename, byte size, UTC timestamp, source database, and operator in the deployment ticket. Copy the dump to approved durable storage and verify it can be read:

```bash
pg_restore --list backups/daycare-predeploy-YYYYMMDDTHHMMSSZ.dump
```

Do not proceed if the backup is empty, unreadable, or was taken from the wrong database.

## Build and migrations

The Render build command is:

```bash
npm ci && npm run build && npm run db:migrate
```

The migration runner applies SQL files once and records them in `schema_migrations`. A database created from scratch applies:

```text
001_initial.sql
002_unique_student_identity.sql
```

The current latest migration is `002_unique_student_identity.sql`. It stops before changing the schema if duplicate normalized student identities exist. Resolve reported duplicates manually while preserving student UUIDs and linked attendance, messages, profiles, and activity. A repeated successful run prints `No pending migrations.`

## Idempotent roster import

After migrations, run:

```bash
npm run import:rosters
```

The approved counts are:

| Branch | Teacher group | Expected students |
| --- | --- | ---: |
| MK | MK HAPPY | 82 |
| MK | MK QIAO EN | 40 |
| MK | MK WEN XUAN | 18 |
| WS | WS HUILING | 46 |
| WS | WS JIA WEN | 61 |
| WS | WS MIXIN | 42 |
| STP | 巧恩 STP | 90 |
| STP | PS STP | 121 |
| STP | SY STP | 50 |

The total is 550. The importer rejects an entire roster file if its count, required cells, group, or `source_ref` uniqueness is wrong. It updates by `(group_code, source_ref)`, so an immediate second run must report the same nine counts, `inserted: 0`, and `updated: 550`; it must not create duplicate students. `MK QIAO EN` contains only its 40-student main roster and excludes 基础班.

## Production smoke checks

Record the exact production URL and whether it is a new optimized URL or a confirmed replacement for an existing service.

1. Health: `curl --fail --silent --show-error "$PRODUCTION_URL/api/health"` returns `{"ok":true}`.
2. Login: an allowlisted Google account and the authorized emergency login each reach the branch entrance; invalid credentials do not.
3. Branch entrance: the first authenticated screen shows only `MK`, `STP`, and `WS`.
4. Teacher isolation: MK, STP, and WS each show exactly their approved three groups; a mismatched branch/group API request returns `400` with `GROUP_BRANCH_MISMATCH`.
5. Roster: `MK QIAO EN` reports 40 active imported students and no 基础班 record; `PS STP` reports 121 and mounts only a virtual window of cards.
6. Enrol: create a uniquely named smoke student in a chosen group, record its UUID, and confirm it appears only there.
7. Attendance: toggle one event, confirm `已保存`, reload, and confirm it remains. Exercise a safe retry scenario only when failure injection is available; do not disrupt production traffic.
8. Stop: stop the smoke student with exact name, grade, and group confirmation; confirm it leaves the active roster.
9. Restore: restore that student; confirm it returns to the same group with the same UUID, profile, attendance, and messages.
10. Profile search: select a student, search for a nonexistent name, and confirm the profile clears, `找不到学生` appears, and `保存学生资料` is absent.
11. Message and summary: save one bounded test message, confirm newest-first display, and confirm the current-group summary refreshes after attendance.
12. Logout: log out and confirm `/api/session` returns `401`.

Run the production Playwright smoke subset only with explicit authorization:

```bash
E2E_BASE_URL="$PRODUCTION_URL" \
E2E_EMERGENCY_PASSWORD="$PRODUCTION_SMOKE_PASSWORD" \
npm run test:e2e -- --grep "first screen|teacher groups|API rejects|logout"
```

The full local acceptance suite uses an isolated pg-mem database and must not be pointed at production because it enrols and changes students.

## Roll back a deployment

If the new web deployment is unhealthy but the database is compatible:

1. In Render, open the intended web service and its **Deploys** page.
2. Select the last known-good deployment by commit and timestamp.
3. choose **Rollback** / **Redeploy this version**, then wait for the health check to pass.
4. Re-run health, login, branch, roster, attendance-read, and logout smoke checks.
5. Record the failed and restored deployment IDs and URLs.

A web rollback does not reverse a database migration. If the previous code is incompatible with the migrated schema, keep the service in maintenance mode and use the restore procedure instead of repeatedly redeploying.

## Restore from backup

Restoring is destructive to the chosen target. Confirm the exact database target, stop application writes, and retain the failed database for investigation. Prefer restoring into a newly created empty PostgreSQL database:

```bash
pg_restore \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --dbname "$RESTORE_DATABASE_URL" \
  backups/daycare-predeploy-YYYYMMDDTHHMMSSZ.dump
```

Then:

1. run `npm run db:migrate` against `RESTORE_DATABASE_URL`;
2. verify all nine roster counts, student UUIDs, attendance, messages, profiles, and `schema_migrations`;
3. point the web service's `DATABASE_URL` at the validated restored database;
4. deploy the compatible application version and run the full smoke checklist;
5. reopen writes only after validation;
6. record the source backup, restored database, deployment, operator, and timestamps.

If policy requires restoring in place, take a second forensic backup first and have a database owner approve the exact `pg_restore --clean --if-exists` target command.

# Shared Password Access Design

## Goal

Remove the Sites “Sign in with ChatGPT” requirement while keeping every student
record and write operation behind a simple login. Teachers will open the same
website, enter one shared system password, and then continue to the existing
MK/STP/WS branch entrance.

## Chosen approach

Use an application-owned shared-password session.

- The Sites access policy becomes public so visitors do not need a ChatGPT
  account.
- “Public” applies only to the outer website address. The application itself
  continues to reject roster reads and all writes until the visitor has a valid
  password session.
- The login screen contains one “系统密码” field. Google and ChatGPT login
  controls are not shown.
- The initial password is generated during deployment and handed to the owner.
  The plaintext password is never committed to source control.

This is preferred over Google allowlisting because it satisfies the requirement
that teachers need no account. A completely unprotected public site is rejected
because it would expose student information and allow unauthorized changes.

## Authentication flow

1. The app calls `GET /api/session` during startup.
2. Without a valid session cookie, the Worker returns `401` and the app shows
   the password screen.
3. The teacher submits the password to `POST /api/session/password`.
4. The Worker compares a SHA-256 digest with the secret digest stored in Sites
   environment variables.
5. On success, the Worker returns an HTTP-only, Secure, SameSite=Strict signed
   session cookie with a 12-hour lifetime.
6. Logout clears the cookie and returns to the password screen.

The session signature uses a separate secret stored only in Sites environment
variables. Signature and digest comparisons use constant-time byte comparison.

## API protection

Only these routes are available without a valid session:

- `GET /api/health`
- `GET /api/session`
- `POST /api/session/password`

Every other `/api/*` route, including catalog, rosters, attendance, messages,
profile updates, enrolment, stop, and restore, must return `401` when the signed
session is missing, expired, malformed, or invalid.

## Abuse controls

Failed password attempts are tracked in D1 by a one-way hash of the client
address. Repeated failures temporarily return `429` with `Retry-After`.
Successful login clears the failure record. The table is bounded by periodic
cleanup of expired rows.

The UI always shows a generic “密码错误，请重试” message so it does not reveal
internal configuration or account information.

## Configuration

Sites environment variables:

- `ACCESS_PASSWORD_SHA256`: SHA-256 digest of the generated shared password.
- `ACCESS_SESSION_SECRET`: independent random secret used to sign cookies.

Both values are marked secret. Changing the shared password requires updating
the digest and redeploying the current saved version so the new environment
revision becomes active.

## Testing and rollout

Automated coverage will verify:

- unauthenticated catalog, roster, and write requests return `401`;
- correct password creates a secure session and unlocks the branch entrance;
- incorrect and repeated passwords fail safely and trigger throttling;
- tampered and expired cookies are rejected;
- logout clears access;
- existing MK/STP/WS roster and student-lifecycle tests still pass.

After local tests and build pass, publish a new Sites version, change access from
owner-only to public, deploy the approved version, and check production health,
login, catalog, and error logs. The existing URL remains unchanged.

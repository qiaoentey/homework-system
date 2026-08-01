# Google Account Login Design

## Goal

Replace the shared system-password entrance with one Google Account sign-in button. Only `qiaoen9816@gmail.com` may enter the daycare system. After sign-in, the existing MK, STP, and WS branch and teacher-selection flow remains unchanged.

## Chosen Approach

Use Google Identity Services on the login screen and reuse the existing Google OAuth web client ID already configured for the older daycare system. The production Sites origin must be added to that client's authorized JavaScript origins.

The browser sends the Google ID token to the Sites Worker. The Worker verifies the token signature and claims against Google's published keys, verifies the configured audience, requires a verified email address, and compares the normalized email exactly with `qiaoen9816@gmail.com`.

This is preferred over allowing every Google account, which would expose student data, and over a Google Workspace-domain restriction, which does not fit a Gmail account.

## User Flow

1. Opening the existing production URL shows only `使用 Google 登录`.
2. The user selects a Google account through Google's sign-in interface.
3. If the verified email is `qiaoen9816@gmail.com`, the Worker creates a secure 12-hour session cookie.
4. The user immediately sees the MK, STP, and WS branch choices.
5. Logging out clears the session and returns to the Google login screen.

No system-password field or emergency-password option is visible or accepted by the production Sites API.

## Security and Data Flow

- Google ID tokens are accepted only on `POST /api/session/google`.
- The Worker validates token format, signature, issuer, audience, expiry, and `email_verified` before trusting the email claim.
- Only the exact normalized allowlisted email can create a session.
- The session remains an HTTP-only, Secure, SameSite=Strict, host-only cookie with a 12-hour lifetime.
- Student, attendance, profile, message, enrolment, stop, and restore APIs continue to require a valid session.
- Audit records use the verified Google email instead of the shared local operator identity.
- Login failures return one generic Chinese message and do not reveal whether the account or token was rejected.

## Components

- `LoginScreen`: loads Google Identity Services and renders one Google sign-in button.
- `App` and API client: submit the Google credential and open the existing branch entrance after success.
- Sites Worker authentication module: verifies Google ID tokens and signs application sessions.
- Sites environment: stores the Google client ID, allowed email, and session-signing secret.
- Google Cloud OAuth client: authorizes `https://daycare-checkin-optimized.cyedu111.chatgpt.site` as a JavaScript origin.

## Error Handling

- Google script unavailable: show `Google 登录暂时无法载入，请刷新重试`.
- Cancelled or failed sign-in: keep the user on the login screen with `Google 登录失败，请重试`.
- Unapproved account, invalid token, expired token, or unverified email: return a generic login failure without creating a cookie.
- Expired or tampered application session: return HTTP 401 and show the login screen again.

## Verification

- Client tests prove that only the Google button appears and the credential is submitted once.
- Worker tests prove signature and claim rejection, exact email allowlisting, secure cookie creation, session expiry, logout, and password-route removal.
- Existing catalog, roster, attendance, profile, message, enrolment, stop, and restore tests remain green.
- Production browser verification covers login with `qiaoen9816@gmail.com`, MK/STP/WS selection, one teacher roster, logout, and error-log inspection.

## Scope Boundary

This design changes authentication only. The separate STP `巧恩` roster-loading bug is caused by a non-ASCII internal group code in an HTTP header; its 90 student records remain present and will be handled as a separate corrective change.

# Vercel API routes

The `api/` directory contains serverless Node.js handlers deployed by Vercel. To stay within the Vercel Hobby plan's 12-function deployment limit, all authenticated workspace routes are rewritten to one catch-all function at `api/workspace/[...path].js`; route logic lives in `server/workspace/index.js`.

## Routes

- `GET /api/leetcode/:username` — public LeetCode profile lookup and normalization.
- `POST /api/auth/signup` — create a MongoDB-backed account.
- `POST /api/auth/login` — start an HttpOnly-cookie session.
- `POST /api/auth/logout` — clear the session cookie.
- `GET /api/auth/me` — return the current account, if signed in.
- `POST /api/auth/forgot-password` — request a time-limited reset email.
- `POST /api/auth/reset-password` — consume a single-use reset token.
- `GET /api/user/profile` and `POST /api/user/profile` — read or update a saved username.
- `DELETE /api/user/account` — permanently delete the signed-in account and its owned snapshots, goals and revision items after email/password confirmation.
- `GET /api/analytics/snapshots` — read the signed-in user's saved daily profile snapshots (rewritten internally to the shared workspace handler).
- `POST /api/analytics/snapshots` — upsert today's snapshot for the account's saved profile.
- `GET /api/goals` — list private goals and calculate progress from the latest saved snapshot.
- `POST /api/goals` — create a 7-day or 30-day goal from a saved snapshot baseline.
- `DELETE /api/goals/:id` — delete a goal owned by the signed-in account.
- `GET /api/revisions` — list private revision items for the account's saved profile.
- `POST /api/revisions` — add a problem to the private revision queue.
- `PATCH /api/revisions/:id` — update a revision item owned by the signed-in user.
- `DELETE /api/revisions/:id` — delete an owned revision item.
- `GET /api/revisions` — list the signed-in user's private revision queue for the saved profile.
- `POST /api/revisions` — add a revision item with validated title, difficulty, optional topic, notes and a canonical public LeetCode problem URL.
- `PATCH /api/revisions/:id` — update a revision item owned by the signed-in user.
- `DELETE /api/revisions/:id` — delete a revision item owned by the signed-in user.
- `POST /api/contact` — validate and store a contact request.

## Required configuration

Account and contact endpoints require `MONGODB_URI`. Registration and login also require `JWT_SECRET` (at least 32 characters). Password reset additionally requires `RESEND_API_KEY`, `EMAIL_FROM`, and a valid `APP_URL`.

When required configuration is missing, routes return a service-unavailable response. They do not create fake accounts or pretend to send email.

## Security notes

- Never collect LeetCode passwords, cookies, or session tokens.
- Passwords are hashed with bcryptjs; session tokens are signed and sent through HttpOnly, SameSite cookies.
- Reset tokens are random, stored only as SHA-256 hashes, expire, and are single use.
- Validate inputs, use same-origin checks on state-changing requests, and set no-store on account responses.
- Snapshots are private, scoped to the authenticated user, and limited to one record per UTC day per saved profile. The dashboard returns the most recent 180 records.
- Goals store a baseline snapshot and measure subsequent saved-snapshot change; they do not infer unsaved daily practice.
- Revision items and personal notes are private, scoped to the authenticated user and saved profile, and limited to 100 entries per profile.
- Revision queue items and notes are private and scoped to the authenticated user and the saved profile; items are limited to 100 per saved profile.
- Current process-local rate limiting is per function instance only. Use a shared rate-limit store before scaling.
- Do not return database details, password hashes, session tokens, or reset tokens to clients.

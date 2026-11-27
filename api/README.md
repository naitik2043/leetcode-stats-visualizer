# Vercel API routes

The `api/` directory contains serverless Node.js handlers deployed by Vercel.

## Routes

- `GET /api/leetcode/:username` — public LeetCode profile lookup and normalization.
- `POST /api/auth/signup` — create a MongoDB-backed account.
- `POST /api/auth/login` — start an HttpOnly-cookie session.
- `POST /api/auth/logout` — clear the session cookie.
- `GET /api/auth/me` — return the current account, if signed in.
- `POST /api/auth/forgot-password` — request a time-limited reset email.
- `POST /api/auth/reset-password` — consume a single-use reset token.
- `GET /api/user/profile` and `POST /api/user/profile` — read or update a saved username.
- `POST /api/contact` — validate and store a contact request.

## Required configuration

Account and contact endpoints require `MONGODB_URI`. Registration and login also require `JWT_SECRET` (at least 32 characters). Password reset additionally requires `RESEND_API_KEY`, `EMAIL_FROM`, and a valid `APP_URL`.

When required configuration is missing, routes return a service-unavailable response. They do not create fake accounts or pretend to send email.

## Security notes

- Never collect LeetCode passwords, cookies, or session tokens.
- Passwords are hashed with bcryptjs; session tokens are signed and sent through HttpOnly, SameSite cookies.
- Reset tokens are random, stored only as SHA-256 hashes, expire, and are single use.
- Validate inputs, use same-origin checks on state-changing requests, and set no-store on account responses.
- Current process-local rate limiting is per function instance only. Use a shared rate-limit store before scaling.
- Do not return database details, password hashes, session tokens, or reset tokens to clients.

# Vercel API routes

LeetMetric uses Node.js serverless handlers in `api/`. Authenticated workspace routes are rewritten by `vercel.json` to the shared `api/workspace/[...path].js` handler; the route-specific logic lives in `server/workspace/index.js`. This keeps the deployed function surface small while preserving readable route handlers.

## Public endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/leetcode/:username` | Fetch and normalize a public LeetCode profile. Includes cache freshness metadata and may serve a clearly labelled cached snapshot for up to 60 minutes during transient upstream failures. |
| GET | `/api/developer/:platform/:username` | Read-only public Codeforces or GitHub profile overview. Providers are allowlisted; handles are validated; upstream requests have timeouts, bounded per-instance caching and in-flight deduplication. |
| POST | `/api/contact` | Validate and store a contact request. |

Public profile lookups do not require a LeetMetric account. LeetMetric does not request LeetCode passwords, session cookies or access tokens.

## Authentication endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create an account. |
| POST | `/api/auth/login` | Authenticate and issue a session cookie. |
| POST | `/api/auth/logout` | Clear the current session cookie. |
| GET | `/api/auth/me` | Return the current public account payload, if signed in. |
| POST | `/api/auth/forgot-password` | Request a time-limited password-reset email. |
| POST | `/api/auth/reset-password` | Consume a single-use reset token and update the password. |

Passwords are hashed with bcryptjs. Session tokens are signed and stored in an HttpOnly, SameSite=Lax cookie (Secure in production). Password-reset tokens are random, stored only as SHA-256 hashes, expire and are single use.

## Authenticated workspace endpoints

All routes below require a valid LeetMetric session unless noted otherwise.

| Method | Endpoint | Purpose |
|---|---|---|
| GET / POST | `/api/user/profile` | Read or update the account's preferred LeetCode username. |
| DELETE | `/api/user/account` | Permanently delete the account and its owned snapshots, goals, revisions, Code Vault items, integration tickets and saved roadmaps. Requires the exact `DELETE` confirmation, account email and current password. The transaction is followed by a record-count verification receipt. |
| GET | `/api/user/export` | Download a private JSON export of the account profile, snapshots, goals, revisions, roadmaps and owned Code Vault snippets. Sensitive authentication material and integration launch tickets are excluded. |
| GET / POST | `/api/analytics/snapshots` | Read private history or upsert today's snapshot for the account's saved profile. History is limited to 180 daily records. |
| GET / POST | `/api/goals` | List goals or create a 7-day / 30-day goal from the latest saved snapshot baseline. |
| DELETE | `/api/goals/:id` | Delete a goal owned by the signed-in account. |
| GET / POST | `/api/revisions` | List or add private revision-queue items for the account's saved profile. |
| PATCH / DELETE | `/api/revisions/:id` | Update or delete a revision item owned by the signed-in account. |
| GET / POST | `/api/roadmaps` | List or save account-synchronized 7/30/90-day roadmaps for the saved LeetCode username. |
| PATCH / DELETE | `/api/roadmaps/:id` | Update title/progress with optimistic version checks, or delete an owned roadmap. |

The JSON account export is intentionally bounded to a maximum of 200 Code Vault snippets, 3 MB of snippet content and a 4 MB serialized response. Large-library bulk/chunked export is not currently implemented. The export endpoint is rate-limited to three requests per hour per source bucket.

Workspace records are scoped by authenticated `userId`; snapshots, goals, revisions and roadmaps are also bound to the account's saved LeetCode username where applicable. Resource IDs alone never grant access to another account's data.

Account deletion uses a MongoDB multi-document transaction. The configured MongoDB deployment must support transactions (MongoDB Atlas or a replica-set / sharded deployment); a standalone local MongoDB server is not sufficient for that workflow.

## Operations

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | No-store health check that verifies the MongoDB connection with a database ping. Returns a generic `ok` or `degraded` result and does not disclose connection strings or database details. |
| POST | `/api/integrations/paste` | Create a short-lived, single-use Paste Vault launch ticket for the signed-in user. Requires Paste Vault to be configured separately. |

The optional GitHub Actions uptime monitor checks the deployed `/api/health` URL. Configure the repository Actions secret `LEETMETRIC_HEALTHCHECK_URL` after the endpoint is deployed. To receive failure notifications, also configure `OPS_ALERT_WEBHOOK_URL`. These secrets are not Vercel deployment credentials and the monitor does not deploy the application.

## Configuration

| Variable | Used by | Notes |
|---|---|---|
| `MONGODB_URI` | Accounts and workspace persistence | MongoDB connection string. |
| `JWT_SECRET` | Authentication | Random secret of at least 32 characters. |
| `RESEND_API_KEY` | Password recovery | Resend API key; required only to send reset emails. |
| `EMAIL_FROM` | Password recovery | Verified Resend sender address. |
| `APP_URL` | Password recovery links | Canonical application URL. |
| `PASTE_APP_URL` | Paste Vault handoff | Origin of the separately deployed Paste Vault application. |
| `UPSTASH_REDIS_REST_URL` | Optional distributed rate limiting | Upstash Redis HTTPS REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional distributed rate limiting | Server-side Upstash REST token. |

Account routes return a service-unavailable response when required database or authentication configuration is missing. They do not create fake accounts or claim that an email was sent when email delivery is not configured.

When both Upstash variables are present, state-changing API limits use an atomic Redis script shared across serverless instances. If either setting is missing or Redis is unavailable, the bounded in-memory fallback applies per function instance; that fallback is not globally distributed.

## Security controls

- State-changing requests enforce a same-origin check. An explicitly cross-site Fetch Metadata request is rejected when the Origin header is absent.
- Authenticated API responses use `Cache-Control: no-store`.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Password hashes, reset-token hashes, session values and one-time integration ticket hashes are never included in public user payloads or account exports.
- User input is validated and bounded before database writes or upstream requests.
- Resource reads, updates and deletes include the authenticated owner ID in their database filters.
- Rate-limit keys hash the route bucket and source address before they are sent to Upstash. Raw IP values are not used as Redis keys.
- Structured operational logs use an allowlist and exclude email addresses, IP addresses, passwords, tokens and request payload contents.
- Never commit `.env`, MongoDB credentials, API keys or production secrets.

## Local quality checks

Run the syntax, API, static-page contract and Node.js test suites:

```bash
npm run check
```

Run the Chromium browser smoke tests:

```bash
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs both quality commands on pushes and pull requests. Browser tests mock API responses; they do not verify a live MongoDB deployment, external provider uptime, authenticated production journeys or the separately deployed Paste Vault application. Those remain production integration checks.

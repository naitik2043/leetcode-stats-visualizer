# LeetMetric — LeetCode Analytics & Progress Workspace

LeetMetric is an independent LeetCode statistics dashboard with a growing account-based workspace. It helps developers understand public profile metrics, save a preferred username, and build a more consistent problem-solving routine.

**Live site:** https://leetmetric-sooty.vercel.app  
**Repository:** https://github.com/naitik2043/leetcode-stats-visualizer

> **Implementation status:** The project currently uses a static multi-page frontend, Vercel Node.js functions, and Mongoose models for account and contact data. Account-related endpoints require the production environment variables listed below. This release is not yet a React/Express MERN application; React migration and an Express service are separate roadmap items.

## Product pages

| Page | Route | Purpose |
|---|---|---|
| Home | `/` | Public LeetCode profile lookup and statistics overview |
| Features | `/features.html` | Current capabilities and clearly labeled roadmap |
| About | `/about.html` | Product purpose and principles |
| FAQ | `/faq.html` | Product, profile, account, and privacy questions |
| Contact | `/contact.html` | Validated contact form and GitHub issue link |
| Log in | `/login.html` | Account sign-in |
| Sign up | `/signup.html` | Account registration |
| Forgot password | `/forgot-password.html` | Request an email reset link |
| Reset password | `/reset-password.html` | Single-use password reset |
| Dashboard | `/dashboard.html` | Signed-in analytics, private history and goal workspace |
| Compare | `/compare.html` | Side-by-side public profile comparison |
| Privacy | `/privacy.html` | Privacy notice |
| Terms | `/terms.html` | Terms of use |

## Current features

- Public LeetCode username lookup without requesting LeetCode credentials.
- Side-by-side comparison of two public profiles using consistent difficulty and submission metrics.
- Private daily profile snapshots for signed-in users, with a historical solved-count trend and snapshot table.
- Personal 7-day and 30-day problem-solving goals measured from saved profile baselines.
- A deterministic 7-day practice planner based on difficulty coverage and public topic counts; the plan is editable and not persisted.
- A private DSA revision queue and mistake journal with status tracking, optional problem links, topic labels and notes.
- Browser-generated PNG profile cards for sharing, with no image upload to the server.
- Public submission calendar heatmap with active days and current streak when available.
- Contest rating, global rank, attended contest count and rating history.
- Topic tag solved counts grouped by LeetCode's fundamental, intermediate and advanced levels.
- Solved-problem counts by Easy, Medium, and Hard difficulty.
- Accepted submissions, total submissions, and acceptance-rate overview.
- Responsive product navigation, account pages, and consistent footer.
- Accessible light/dark theme switcher with a saved preference and system-theme fallback.
- MongoDB-backed registration, login, logout, current-session, and saved-profile endpoints.
- Password hashing with bcryptjs and signed HttpOnly session cookies.
- Password-reset token flow with expiry and single-use semantics.
- Validated contact-message persistence.
- Account deletion requiring current-password and email confirmation, with transactional cleanup of account-owned analytics, practice data and Paste Vault records.
- One-time authenticated handoff to Paste Vault, a separate private code workspace for LeetCode solutions, reusable patterns and version history.
- Server-side LeetCode GraphQL request with username validation, upstream timeout, and short-lived cache.
- SEO sitemap, robots rules, favicon, and baseline security response headers.

Account and contact features return a clear service-unavailable response until the MongoDB and JWT environment variables are configured. Password recovery additionally requires a verified sender and Resend API key.

## Deployment function budget

Vercel Hobby deployments allow at most 12 Serverless Functions. The project keeps the six authentication routes, public LeetCode lookup, and contact endpoint separate, while `vercel.json` rewrites profile, account, snapshot, goal, and revision endpoints through a single `/api/workspace/*` catch-all function. This keeps the deployed function count below the plan limit without removing the existing public API URLs.

## Architecture

```text
Browser
  |
  +-- Static HTML / CSS / JavaScript pages
  |
  +-- Vercel Node.js Functions
        |
        +-- /api/leetcode/:username
        |      +-- LeetCode GraphQL
        |
        +-- /api/auth/*
        |      +-- bcryptjs password hashing
        |      +-- JWT in HttpOnly cookie
        |      +-- Mongoose User model
        |
        +-- /api/user/profile
        |      +-- Saved LeetCode username
        |
        +-- /api/workspace/* (shared catch-all function)
               +-- profile and account management
               +-- daily snapshots and goals
               +-- private revision queue
        |
        +-- /api/contact
               +-- Mongoose ContactMessage model
                         |
                         v
                      MongoDB
```

### Authentication model

- Passwords are hashed with bcryptjs (12 salt rounds); plaintext passwords are never persisted.
- Session tokens are signed with `JWT_SECRET` and stored in an HttpOnly, SameSite=Lax cookie. The cookie is Secure in production.
- Logout expires the session cookie.
- Password reset uses a random token, stores only its SHA-256 hash, expires after 15 minutes, and invalidates older sessions after a successful reset.
- Mutating routes verify the request origin and validate their input.
- Current rate limits are in-memory per serverless function instance. Use a shared Redis-backed limiter before higher-traffic production use.

## Technology

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| API runtime | Node.js on Vercel Functions |
| Database ODM | Mongoose |
| Database | MongoDB |
| Password security | bcryptjs |
| Session signing | jsonwebtoken |
| Hosting | Vercel |
| LeetCode data | LeetCode public GraphQL endpoint |
| Password reset email | Resend (optional, requires configuration) |

## Run locally

### Prerequisites

- Node.js 20 or later
- npm
- MongoDB Atlas cluster or local MongoDB
- Vercel CLI

### Installation

```bash
git clone https://github.com/naitik2043/leetcode-stats-visualizer.git
cd leetcode-stats-visualizer
npm install
cp .env.example .env
```

Fill in the environment variables in `.env`, then start the app:

```bash
npm run dev
```

The Vercel local development server will print the local URL (typically `http://localhost:3000`).

### Environment variables

| Variable | Required | Description |
|---|---:|---|
| `MONGODB_URI` | Yes, for accounts/contact | MongoDB connection string |
| `JWT_SECRET` | Yes, for sessions | Random secret with at least 32 characters |
| `RESEND_API_KEY` | For password reset | Resend API key |
| `EMAIL_FROM` | For password reset | Verified sender address in Resend |
| `APP_URL` | Recommended | Canonical public application URL |
| `PASTE_APP_URL` | For Code Vault | Paste Vault origin, e.g. `https://paste-app-wine.vercel.app` |

Generate a strong session secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not commit `.env`, production secrets, MongoDB credentials, or API keys. Add the values in **Vercel → Project → Settings → Environment Variables** for Production, Preview, and Development as required. Redeploy after adding or changing variables.

### MongoDB setup notes

1. Create a MongoDB Atlas cluster and a database user with a strong password.
2. Add the connection URI as `MONGODB_URI`.
3. Configure Atlas network access for the deployment environment; avoid broad network access unless you understand the exposure and have compensating controls.
4. Keep the database user scoped to the LeetMetric database and its required collections.

### Password reset email setup

Configure a Resend account, verify the sending domain/address, then add `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Until those values exist, the reset endpoint reports that email delivery is not configured instead of pretending an email was sent.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/leetcode/:username` | Read public LeetCode stats |
| POST | `/api/auth/signup` | Create an account |
| POST | `/api/auth/login` | Start a session |
| POST | `/api/auth/logout` | End a session |
| GET | `/api/auth/me` | Get the current account |
| POST | `/api/auth/forgot-password` | Request a reset email |
| POST | `/api/auth/reset-password` | Set a new password |
| GET / POST | `/api/user/profile` | Read or save a preferred username |
| DELETE | `/api/user/account` | Permanently delete an authenticated account and owned data |
| GET / POST | `/api/analytics/snapshots` | Read or save the signed-in user's daily profile snapshots |
| GET / POST | `/api/goals` | List or create personal practice goals |
| GET / POST | `/api/revisions` | List or add private DSA revision items |
| PATCH / DELETE | `/api/revisions/:id` | Update or delete an owned revision item |
| DELETE | `/api/goals/:id` | Delete an owned practice goal |
| POST | `/api/integrations/paste` | Create a short-lived one-time Paste Vault launch URL |
| POST | `/api/contact` | Store a validated contact request |

## Quality checks

Run JavaScript syntax checks and the dependency-free LeetCode normalization unit tests with:

```bash
npm run check
```

GitHub Actions runs the same quality command on pushes to feature branches and on pull requests targeting main. The project should also be tested with a configured MongoDB database and a non-production email sender before enabling public account registration. Test successful signup/login/logout, duplicate email handling, invalid credentials, expired sessions, saved profile validation, reset token expiry/reuse, and contact form validation.

## Roadmap

### Product and analytics
- [ ] React + Vite component-based frontend migration.
- [ ] Historical LeetCode snapshots and time-series charts.
- [ ] Profile comparison and community leaderboards.
- [ ] Topic-level practice planning and activity history.
- [ ] Exportable profile reports.

### Platform
- [ ] Express.js API service and explicit API versioning.
- [ ] Email verification and account deletion workflow.
- [ ] Shared Redis caching and distributed rate limiting.
- [ ] Automated integration tests and CI checks.
- [ ] Observability, abuse monitoring, and operational alerts.

### AI
- [ ] Optional AI study coach grounded in retrieved profile data.
- [ ] Topic recommendations and weekly practice plans.
- [ ] Explanations that clearly distinguish official metrics from generated suggestions.

## Security and privacy

- Never ask for a LeetCode password, session cookie, or access token.
- Keep secrets on the server and out of frontend code.
- Validate request payloads before writing to MongoDB or calling upstream services.
- Do not expose password hashes or reset tokens through API responses.
- Use shared rate limiting and abuse monitoring before scaling public registration.
- Review [Privacy Policy](./privacy.html) and [Terms of Use](./terms.html).

## Contributing

Focused pull requests are welcome. Include the reason for the change, reproduction steps, screenshots for UI changes, and any relevant test output.

## License

MIT. See [LICENSE](./LICENSE).

## Disclaimer

LeetMetric is an independent community project and is not affiliated with, endorsed by, or sponsored by LeetCode. LeetCode is a trademark of its respective owner.


## Paste Vault integration

The signed-in dashboard contains a Code Vault entry that opens the separate Paste Vault application. LeetMetric validates the current session and creates a 90-second, single-use launch ticket. Paste Vault verifies that ticket, consumes it from the shared MongoDB database and issues its own HttpOnly session cookie. The ticket is delivered in the URL fragment, not as a query parameter, and cannot be reused.

Both applications must be configured with the same MONGODB_URI and JWT_SECRET. LeetMetric additionally needs PASTE_APP_URL set to the deployed Paste Vault origin. Paste Vault is private by default; individual snippets may be made unlisted by the user. Anyone who receives an unlisted link can view its content.

LeetMetric account deletion also removes the user's Code Vault snippets and outstanding launch tickets in the same database transaction.

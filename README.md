# LeetMetric — DSA Performance Intelligence Workspace

[![Quality checks](https://github.com/naitik2043/leetcode-stats-visualizer/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/naitik2043/leetcode-stats-visualizer/actions/workflows/quality.yml) [![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

LeetMetric is an independent LeetCode analytics and learning workspace. It turns publicly available profile statistics into transparent practice signals, then combines them with private goals, revision notes and exportable reports.

**Live site:** https://leetmetric-sooty.vercel.app  
**Repository:** https://github.com/naitik2043/leetcode-stats-visualizer

> **Current architecture:** static multi-page HTML/CSS/Vanilla JavaScript frontend, Node.js serverless functions on Vercel, Mongoose models and MongoDB. This repository is not currently a React/Express MERN application. A Git push does not mean that a production redeploy has been requested.

## Product pages

| Page | Route | Purpose |
|---|---|---|
| Home | / | Public profile lookup and core statistics |
| Features | /features.html | Shipped product capabilities and limitations |
| Dashboard | /dashboard.html | Signed-in workspace for analytics and personal tracking |
| Compare | /compare.html | Compare two public profiles, topics, activity and contest signals |
| Performance Intelligence | /intelligence.html | DSA practice index, topic coverage candidates and evidence-linked suggestions |
| DSA Roadmap | /roadmap.html | Editable 7/30/90-day practice outline |
| Code Review Lab | /code-lab.html | Browser-only static pattern analysis for C++, Java, Python, JavaScript and C |
| Interview Readiness | /readiness.html | DSA signals plus user-entered interview preparation self-assessment |
| Progress Reports | /reports.html | JSON/CSV/print exports and authorized snapshot history |
| Developer Profile | /developer-profile.html | Read-only LeetCode, Codeforces and GitHub public profile overview |
| About / FAQ / Contact | /about.html, /faq.html, /contact.html | Product information and contact |
| Account | /login.html, /signup.html, etc. | Authentication and password recovery |

## Current capabilities

### Public LeetCode analytics
- Username lookup without requesting LeetCode credentials.
- Solved problems by Easy, Medium and Hard difficulty.
- Accepted and total submission counts and acceptance rate.
- Global ranking and total question-bank coverage where returned.
- Public submission calendar, active-day count and current streak where available.
- Contest rating, global rank, participation and rating history where available.
- Tag-level topic solved counts grouped by LeetCode's fundamental, intermediate and advanced tags.

### Comparison and personal workspace
- Side-by-side comparison with difficulty, submission, topic, activity and contest metrics.
- Shareable comparison URL and CSV export.
- Private daily profile snapshots, historical trend and 180-day retention.
- Account-synchronized 7/30/90-day roadmaps with owner-scoped CRUD, saved weekly completion state, and version tracking.
- A private JSON account-data export covering snapshots, goals, revisions, roadmaps and Code Vault snippets.
- Transaction-backed account deletion followed by a record-count verification receipt.
- 7-day and 30-day personal goals measured against saved snapshot baselines.
- Private DSA revision queue and mistake journal.
- Browser-generated PNG profile card.
- Seven-day dashboard practice planner.
- Private Paste Vault launch using a short-lived one-time authenticated handoff.

### Learning intelligence tools
- Shared deterministic intelligence engine with normalized inputs and UTC activity windows.
- Transparent practice foundation index: equal-weight components for problem volume, Medium/Hard balance, topic breadth and 30-day activity consistency.
- Lower solved-count topic candidates and evidence-linked practice suggestions.
- Private revision mistake summary derived from the signed-in user's saved revision entries.
- Optional user-recorded attempts-before-acceptance and time-spent fields per revision, with aggregate first-attempt rate and average logged time. These represent only the entries the user records, not all LeetCode submissions.
- Personalized 7-day, 30-day and 90-day DSA roadmap generation, browser-local progress, account synchronization and JSON export.
- Browser-only static code review heuristics for common loop, sorting and collection patterns.
- Interview preparation self-assessment combining a DSA practice signal with user-entered ratings for CS fundamentals, project ownership, communication, mock interviews and resume alignment.
- Progress reports with JSON/CSV export, print support and conservative next-milestone pace estimate when sufficient private history exists.
- Cross-platform public profile summary for LeetCode, Codeforces and GitHub; Codeforces user data uses its public API, and GitHub languages/stars are explicitly sampled from up to 100 owner repositories.

## Metric and feature limitations

LeetMetric deliberately labels derived metrics and heuristics:

- The public LeetCode GraphQL endpoint is an upstream dependency, not a guaranteed versioned API. Fields can be partial or change. Profile responses include freshness metadata and may serve a clearly labelled cached snapshot for up to one hour during transient upstream failures.
- Public calendar counts are submissions, not unique accepted problems or exact time spent studying.
- Topic tags overlap and lower solved counts are directional coverage candidates, not proof of weak mastery.
- The practice foundation index is a limited learning signal, not an employer score or hiring prediction.
- The roadmap creates an editable topic plan, not a curated list of guaranteed problem links. Progress can be stored locally or synchronized to the signed-in account when its saved LeetCode username matches.
- The Code Review Lab is static pattern matching, not an AST-based compiler, AI code reviewer, execution sandbox or correctness proof. Snippets stay in the browser and are not submitted to LeetMetric APIs.
- Interview self-assessment ratings are user-entered and saved in the current browser.
- Next-milestone timing is a linear estimate only when snapshots span at least 7 days and show positive net growth. It can change as pace changes.
- Private history is returned only to the authenticated account that owns the selected LeetCode username.
- First-attempt success, per-problem retries and time-to-solve are not inferred from the current public profile response. Optional attempt and time analytics are based only on values voluntarily recorded in the private revision journal.
- Codeforces and GitHub profile lookups are read-only public username lookups, not OAuth identity verification. GitHub profile endpoints are subject to GitHub public API rate limits.

## Architecture

~~~text
Browser
  |
  +-- Static HTML / CSS / Vanilla JavaScript
  |     +-- intelligence-engine.js (shared deterministic calculations)
  |     +-- page modules, theme and accessible UI states
  |
  +-- Vercel Node.js Functions
        +-- /api/leetcode/:username
        |     +-- LeetCode public GraphQL
        |     +-- normalized profile, freshness metadata and bounded cache
        |
        +-- /api/developer/:platform/:username
        |     +-- Codeforces public API / GitHub REST API
        |     +-- allowlisted providers, timeout and bounded per-instance cache
        |
        +-- /api/auth/*
        |     +-- bcryptjs password hashing
        |     +-- JWT in HttpOnly cookie
        |
        +-- /api/workspace/* (shared catch-all handler)
        |     +-- account profile, export and verified deletion
        |     +-- daily snapshots, goals and private revisions
        |     +-- saved DSA roadmaps with version-checked updates
        |     +-- no-store MongoDB health check
        |
        +-- /api/integrations/paste
        |     +-- short-lived, single-use Paste Vault ticket
        |
        +-- /api/contact
              +-- validated contact-message persistence
                    |
                    v
                 MongoDB

The Code Review Lab does not execute user code. The shared intelligence engine is dependency-free and can be tested in Node.js while also being loaded by browser pages.

## Repository structure

The repository separates public pages, browser assets, serverless handlers, backend services, tests and project documentation:

```text
.
├── pages/                 # Public HTML pages (19 routes)
├── assets/
│   ├── css/               # Shared and page-specific stylesheets
│   ├── js/                # Browser JavaScript modules
│   └── images/             # Favicon and preview artwork
├── api/                   # Vercel serverless route handlers
├── server/
│   ├── models/             # Mongoose schemas
│   └── workspace/          # Authenticated workspace route logic
├── tests/
│   ├── contracts/          # HTML and asset contract checks
│   ├── e2e/                 # Playwright browser journeys
│   └── unit/                # Node.js unit tests
├── scripts/                # Local test tooling
├── docs/                   # Product roadmap and technical notes
├── .github/workflows/      # CI and opt-in uptime monitor
├── package.json
├── playwright.config.js
└── vercel.json              # Public page and API route rewrites
```

The public URLs remain unchanged (for example, `/dashboard.html` and `/roadmap.html`). Vercel rewrites those paths to the HTML files under `pages/`; asset URLs are served from `/assets/`. This keeps existing links, sitemap entries and browser navigation stable while the source tree stays organized.

## Technology

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend runtime | Node.js on Vercel Functions |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | bcryptjs, jsonwebtoken, HttpOnly cookies |
| LeetCode data | Public LeetCode GraphQL endpoint |
| Hosting | Vercel |
| Email recovery | Resend (optional, requires verified sender configuration) |
| Testing | Node.js built-in test runner, Playwright, GitHub Actions |

## Run locally

### Prerequisites
- Node.js 22 or later (required by the current Playwright browser-test toolchain)
- npm
- MongoDB Atlas cluster or a local MongoDB replica set (account deletion uses transactions)
- Vercel CLI

### Installation
~~~bash
git clone https://github.com/naitik2043/leetcode-stats-visualizer.git
cd leetcode-stats-visualizer
npm install
cp .env.example .env
~~~

Fill in the environment variables in .env, then start the local Vercel development server:

~~~bash
npm run dev
~~~

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| MONGODB_URI | Accounts, snapshots, goals, revisions and contact | MongoDB connection string |
| JWT_SECRET | Account sessions | Random secret with at least 32 characters |
| RESEND_API_KEY | Password reset emails | Resend API key |
| EMAIL_FROM | Password reset emails | Verified sender address |
| APP_URL | Recommended | Canonical public application URL |
| PASTE_APP_URL | Paste Vault integration | Paste Vault origin |
| UPSTASH_REDIS_REST_URL | Optional distributed rate limiting | Upstash Redis HTTPS REST URL |
| UPSTASH_REDIS_REST_TOKEN | Optional distributed rate limiting | Upstash Redis standard server-side token |

Generate a session secret locally:

~~~bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
~~~

Never commit .env, MongoDB credentials, API keys or production secrets.

### MongoDB and account setup
1. Create a database user scoped to the LeetMetric database.
2. Set MONGODB_URI and a strong JWT_SECRET.
3. Configure appropriate Atlas network access.
4. Configure a verified Resend sender for password recovery.
5. Configure PASTE_APP_URL only when the separate Paste Vault application is available and shares the intended MongoDB deployment.

## API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | No-store application/database health check |
| GET | /api/leetcode/:username | Public LeetCode profile analytics |
| GET | /api/developer/:platform/:username | Public Codeforces or GitHub profile overview |
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login | Start a session |
| POST | /api/auth/logout | End a session |
| GET | /api/auth/me | Current account |
| POST | /api/auth/forgot-password | Request reset email |
| POST | /api/auth/reset-password | Apply single-use password reset |
| GET / POST | /api/user/profile | Read or save preferred LeetCode username |
| DELETE | /api/user/account | Delete account and owned workspace data with a verification receipt |
| GET | /api/user/export | Export private account data as JSON |
| GET / POST | /api/roadmaps | List or create account-synchronized DSA roadmaps |
| PATCH / DELETE | /api/roadmaps/:id | Update progress/title or delete an owned roadmap |
| GET / POST | /api/analytics/snapshots | Read or save daily snapshots |
| GET / POST | /api/goals | List or create goals |
| DELETE | /api/goals/:id | Delete an owned goal |
| GET / POST | /api/revisions | List or create private revision items |
| PATCH / DELETE | /api/revisions/:id | Update or delete an owned revision item |
| POST | /api/integrations/paste | Create a one-time Paste Vault launch URL |
| POST | /api/contact | Store a validated contact request |

The Developer Profile page calls a same-origin serverless adapter that retrieves public data from the official Codeforces API and GitHub REST API. The adapter allowlists providers, validates handles, applies timeouts, caches responses and isolates platform errors. No platform API secrets are required or stored by LeetMetric.

The intelligence, roadmap, code review, readiness and report calculations currently run in the browser; they do not require an AI API key.

## Quality checks

Run syntax, unit and static page-contract checks:

~~~bash
npm run check
~~~

Run real Chromium browser smoke tests (navigation/theme, static code review and roadmap generation/fallback):

~~~bash
npx playwright install chromium
npm run test:e2e
~~~

The command performs JavaScript syntax checks, static HTML/asset contract checks and runs Node's built-in unit test suite. GitHub Actions uses Node.js 24 and runs these checks on pushes to main and feature branches and on pull requests targeting main. The workflow then installs Chromium and runs three Playwright smoke journeys: homepage navigation/theme persistence, browser-only code analysis, and roadmap generation with stale-data and local-save fallback handling. These E2E tests mock public/API responses and do not require production credentials or a database. The green badge above reflects the latest `quality.yml` workflow on `main`; it is separate from Vercel deployment status.

Before production growth, add database-backed integration tests, broader authenticated end-to-end coverage, automated accessibility scans and visual regression checks. An hourly GitHub Actions uptime monitor is included; set the `LEETMETRIC_HEALTHCHECK_URL` Actions secret after the health endpoint is deployed. Optionally set `OPS_ALERT_WEBHOOK_URL` to receive failure notifications. The current browser suite is a focused smoke suite rather than full user-journey coverage. Without Upstash credentials, rate limiting uses a bounded in-memory fallback scoped to each serverless instance. When both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured, state-changing API limits use an atomic Redis Lua script shared across instances. If Redis is temporarily unavailable, the application logs a sanitized fallback event and uses its local limiter; that degraded mode is not globally distributed.

## Roadmap

The maintained implementation roadmap lives in docs/PRODUCT-ROADMAP.md. Remaining planned items include broader authenticated browser journeys, automated accessibility/visual regression coverage, richer operations dashboards, an optional server-side AI study coach, isolated code execution, additional platform integrations and any future frontend migration. These are not represented as shipped features.

## Security and privacy

- Never ask for LeetCode passwords, session cookies or access tokens.
- Keep secrets on the server and out of browser bundles.
- Validate user input before persistence or upstream requests.
- Do not expose password hashes, reset tokens or private session values in responses.
- Use shared rate limiting and abuse monitoring before scaling public registration.
- Review Privacy Policy (privacy.html) and Terms of Use (terms.html).

## Contributing

Focused pull requests are welcome. Include context, reproduction steps, test output and screenshots for visible UI changes. Keep feature documentation aligned with the shipped implementation.

## License

MIT. See LICENSE.

## Disclaimer

LeetMetric is an independent community project and is not affiliated with, endorsed by, or sponsored by LeetCode. LeetCode is a trademark of its respective owner.

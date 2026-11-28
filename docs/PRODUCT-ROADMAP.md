# LeetMetric product roadmap

This roadmap is the source of truth for shipped and planned work. A capability is marked shipped only when its user flow, data handling, limitations and relevant automated tests are documented.

## Product principles

- **Accuracy before spectacle:** never present estimates, heuristic output or generated suggestions as official LeetCode metrics.
- **Privacy by default:** never request a LeetCode password, session cookie or browser token.
- **Progressive enhancement:** public profile lookup remains available without an account.
- **Transparent limitations:** missing upstream data stays missing; do not fabricate values.
- **Reviewable delivery:** ship coherent changes with meaningful commits, tests and accurate documentation.

## Shipped capabilities

### Public analytics
- [x] Public LeetCode username lookup and normalized difficulty/submission statistics.
- [x] Public submission activity calendar and current streak when available.
- [x] Contest rating, global ranking, participation and attended-contest history when available.
- [x] Tag-level topic solved counts, with explicit overlap and non-mastery caveats.
- [x] Side-by-side public profile comparison with difficulty, submissions, topic coverage, activity and contest signals.
- [x] Shareable comparison links and CSV export.
- [x] Read-only public developer profile summary for LeetCode, Codeforces and GitHub using public platform endpoints.
- [x] Same-origin developer platform adapter with provider allowlisting, username validation, upstream timeouts, bounded cache, concurrent-request deduplication and Codeforces pacing.
- [x] Bounded process-local cache, request deduplication, input validation and upstream timeouts.

### Personal workspace
- [x] Account registration, login/logout, HttpOnly cookie sessions and password reset token flow.
- [x] Saved LeetCode username and account deletion workflow.
- [x] Private daily profile snapshots with 180-day retention.
- [x] Historical solved-count trend and snapshot table.
- [x] 7-day and 30-day goals measured from saved snapshot baselines.
- [x] Private revision queue and mistake journal with topic, difficulty, mistake type, notes and status.
- [x] Browser-generated profile card export.
- [x] Deterministic 7-day editable practice planner on the dashboard.
- [x] Private Paste Vault handoff using a short-lived one-time token; Paste Vault is a separate application.

### Learning intelligence and product tools
- [x] Shared deterministic intelligence engine for profile normalization, activity windows, recommendations and topic coverage signals.
- [x] Transparent practice foundation index with published equal-weight methodology.
- [x] Evidence-linked practice recommendations and lower solved-count topic candidates.
- [x] Private mistake-pattern summary derived only from the signed-in user's revision records.
- [x] Optional user-recorded attempts-before-acceptance and time-spent metadata, validated and aggregated only from the owner's private revision items.
- [x] Personalized 7-day, 30-day and 90-day roadmap generator.
- [x] Browser-local roadmap completion tracking and JSON export.
- [x] Multilingual static code review lab for C++, Java, Python, JavaScript and C.
- [x] Interview preparation self-assessment combining DSA signals with user-entered ratings.
- [x] Progress report preview with JSON and CSV export, printable layout and private history when authorized.
- [x] Conservative next-milestone pace estimate, shown only with at least 7 days of positive net change in saved snapshots.
- [x] Light/dark theme, responsive layouts, public feature index and product documentation.
- [x] GitHub Actions syntax and unit-test workflow.

## Known limitations

- LeetMetric relies on LeetCode's public GraphQL endpoint; it is not a guaranteed, versioned commercial API and may return partial data or change fields.
- Public profile calendar entries are submission counts, not unique accepted problems, exact study time or complete attempt-level histories.
- The topic intelligence engine uses tag-level solved counts as directional coverage signals. Tag categories overlap and do not establish mastery.
- First-attempt success, retries per problem and time-to-solve cannot be reliably inferred from the current public profile response. LeetMetric therefore offers optional manual fields in the private revision journal; their aggregate reflects only the problems the user records and is not a complete account-wide rate.
- The practice foundation index measures a deliberately small set of observable signals. It is not a hiring prediction or a validated interview-readiness score.
- The roadmap generator creates an editable study outline, not a verified list of LeetCode problem URLs. Roadmap completion is stored in the current browser, not the account database.
- The Code Review Lab is static pattern matching. It is not an AST-based compiler, AI reviewer, execution sandbox, complexity proof or correctness verifier.
- Interview preparation self-ratings are user-entered and stored in the current browser.
- Progress exports include private snapshots only when the signed-in account has saved the selected username.
- Current rate limits are in-memory per serverless function instance. A shared distributed limiter is required before higher-traffic production use.
- The frontend remains static HTML/CSS/Vanilla JavaScript with Vercel Node.js functions. React/Vite and an Express service are not part of the current implementation.
- Codeforces API calls are subject to the platform’s documented request-frequency limit; the serverless adapter adds per-instance pacing and caching, but cannot guarantee a global request schedule across separate serverless instances. GitHub public REST requests are subject to unauthenticated rate limits.
- GitHub language and star totals use a bounded recent repository sample (up to 100 owner repositories), not all repositories.
- Codeforces/GitHub username lookups do not prove that those profiles belong to the same person as the LeetCode profile.
- The Paste Vault integration requires PASTE_APP_URL, shared MongoDB configuration and its own deployment.

## Planned work

### P1 — Reliability and durable learning
- [ ] Add stale-data metadata and improved upstream degradation states across all profile views.
- [ ] Persist generated roadmaps and completion data to authenticated accounts, with edit/version history.
- [ ] Add user-recorded attempt outcomes and optional time-to-solve tracking, with privacy controls.
- [ ] Add account-level CSV/JSON export and a complete data export/delete verification flow.
- [ ] Add end-to-end UI tests, accessibility automation and visual regression coverage.
- [ ] Add observability, operational alerts and upstream health monitoring.
- [ ] Introduce Redis/Upstash shared caching and distributed rate limiting before scaling.

### P2 — AI-assisted learning and interview preparation
- [ ] Add optional server-side AI study coach grounded only in verified user analytics and revision notes.
- [ ] Add AI explanations with citations to the exact metrics used and a clear AI-generated label.
- [ ] Add verified problem test execution in an isolated sandbox; never run untrusted code in the main API process.
- [ ] Add mock interview workflows and structured feedback rubrics.
- [ ] Add company-specific preparation only with a maintained, licensed or otherwise reliable question data source.

### P3 — Developer ecosystem
- [ ] Extend the existing Codeforces/GitHub public profile overview with deeper historical and repository analytics where platform limits permit.
- [ ] Add CodeChef, AtCoder and GeeksforGeeks integrations where stable public APIs or permitted data sources exist.
- [ ] Add profile ownership verification and explicit connection/disconnection controls.
- [ ] Build a unified developer profile with source attribution and duplicate-problem handling.
- [ ] Add public challenges, leaderboards and social features only with moderation, reporting and privacy controls.

### Platform evolution
- [ ] Migrate the static frontend to React + Vite in incremental route-sized steps after parity tests exist.
- [ ] Evaluate an Express service only if routing, background jobs or deployment needs justify a separate API runtime.
- [ ] Add API versioning and shared service contracts before introducing multiple frontends.
- [ ] Keep deployment and production release steps explicit; code pushes must not silently trigger a manual Vercel redeploy request.

## Release acceptance checklist

Every release should pass:

1. npm run check and relevant unit/integration tests.
2. Loading, empty, invalid-input, unauthorized, rate-limit, timeout and upstream-error states.
3. Keyboard navigation, visible focus, accessible labels and reduced-motion behavior.
4. Dark and light theme checks.
5. Responsive checks around 360px, 390px, 768px, 1024px and 1440px.
6. No secrets, LeetCode credentials, reset tokens or private session data in frontend code or logs.
7. Documentation that distinguishes shipped behavior from planned work.
8. No production deployment unless explicitly requested.

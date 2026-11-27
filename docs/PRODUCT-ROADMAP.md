# LeetMetric product roadmap

This roadmap keeps implementation incremental. A feature is marked complete only after its user flow, data source, error handling and tests are in place.

## Product principles

- **Accurate before impressive:** never display estimated or generated values as official LeetCode metrics.
- **Privacy by default:** never request LeetCode passwords, session cookies or browser tokens.
- **Progressive enhancement:** public lookup must continue working without a signed-in account.
- **Responsive by design:** every new screen must work with keyboard, touch, narrow mobile widths and desktop layouts.
- **Reliable integrations:** treat LeetCode's public GraphQL endpoint as an upstream dependency, not a guaranteed commercial API.
- **Small, reviewable releases:** ship one coherent phase at a time with tests and a documented change summary.

## Phase 0 — Product and engineering foundation

**Status: implemented in the core dashboard foundation release**

- [x] Reorganize the signed-in dashboard into overview, analytics, profile settings and account settings.
- [x] Provide responsive layouts for desktop, tablet and mobile widths.
- [x] Add an accessible difficulty distribution chart using values returned by the existing profile API.
- [x] Show total question-bank coverage and the last successful fetch time.
- [x] Add explanatory copy for solved problems versus submission attempts.
- [x] Extract LeetCode response normalization into a dependency-free service.
- [x] Bound the process-local cache and deduplicate concurrent requests for the same username.
- [x] Add unit tests for profile normalization and malformed counters.
- [x] Add GitHub Actions quality checks.

## Phase 1 — Historical progress and richer LeetCode analytics

**Priority: P0 — next**

- [ ] Persist timestamped profile snapshots for signed-in users who save a profile.
- [ ] Add historical problem-solved and acceptance-rate charts.
- [ ] Add a GitHub-style activity heatmap when reliable daily submission data is available.
- [ ] Add current and maximum streaks only when the underlying date-level data supports them.
- [ ] Add contest rating, rank and participation history using verified public data sources.
- [ ] Add refresh timestamps, stale-data labels and clear upstream availability states.
- [ ] Provide data-retention controls and account-level deletion for stored snapshots.

## Phase 2 — Topic intelligence and comparison

**Priority: P1**

- [ ] Add topic-level solved counts from a maintained problem metadata source.
- [ ] Show topic coverage, strengths and practice gaps.
- [ ] Compare two public profiles using the same metric definitions.
- [ ] Add side-by-side difficulty, topic and contest comparisons.
- [ ] Label unavailable or partial data instead of filling gaps with assumptions.

## Phase 3 — Personal practice workspace

**Priority: P1**

- [ ] Add user-defined weekly and monthly goals.
- [ ] Add a revision queue and problem revisit journal.
- [ ] Add practice plans that users can edit and complete.
- [ ] Add a transparent consistency score based on recorded activity.
- [ ] Add an interview-readiness estimate with a published methodology.

## Phase 4 — AI study coach

**Priority: P2**

- [ ] Add an optional AI coach grounded in stored, verified user analytics.
- [ ] Generate editable 7-day, 30-day and 90-day practice plans.
- [ ] Explain recommendations and cite the metrics that informed them.
- [ ] Add a weekly report with a clear distinction between measured values and AI-generated advice.
- [ ] Keep AI credentials server-side and provide graceful fallback when AI is not configured.

## Phase 5 — Community and achievements

**Priority: P2**

- [ ] Add public developer profiles and shareable profile cards.
- [ ] Add friend connections and private friend comparisons.
- [ ] Add transparent weekly and monthly leaderboards.
- [ ] Add challenges and achievements with verifiable award criteria.
- [ ] Add reporting, blocking and privacy controls before public social features.

## Phase 6 — Multi-platform developer analytics

**Priority: P3**

- [ ] Add CodeChef, Codeforces, AtCoder and HackerRank integrations where stable public data is available.
- [ ] Add GitHub OAuth and public repository analytics.
- [ ] Prevent duplicate problem counts across platforms where problem identity can be matched.
- [ ] Create a unified developer profile and exportable report.

## Release acceptance checklist

Every phase must pass:

1. The npm quality command and the relevant integration tests.
2. Keyboard navigation and visible focus checks.
3. Responsive checks at approximately 360px, 390px, 768px, 1024px and 1440px.
4. Dark and light theme checks.
5. Loading, empty, invalid-input, rate-limit, timeout and upstream-error states.
6. No secrets, LeetCode credentials or private session data in browser code or logs.
7. Documentation that distinguishes implemented features from roadmap items.
